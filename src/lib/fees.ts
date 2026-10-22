import 'server-only'
import { BillingPeriod, FeeType, MemberStatus, PaymentType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'

export type SubscriptionStatus = 'PAID' | 'DUE' | 'OVERDUE'

export function selectEffectiveFeeVersion<T extends { effectiveFrom: Date; id: string }>(versions: T[], date: Date): T | null {
  return versions
    .filter((version) => version.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.id.localeCompare(a.id))[0] ?? null
}

export function resolveMemberFeeType(status: MemberStatus): PaymentType | null {
  if (status === 'PENDING_REGISTRATION') return 'REGISTRATION'
  if (status === 'ACTIVE') return 'SUBSCRIPTION'
  return null
}

export async function getCurrentFee(type: FeeType, date = new Date()) {
  const versions = await prisma.feeSetting.findMany({
    where: { type, effectiveFrom: { lte: date } },
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    take: 2,
  })
  const fee = selectEffectiveFeeVersion(versions, date)
  if (!fee || type !== 'SUBSCRIPTION') return fee
  const setting = await prisma.setting.findUnique({ where: { key: 'subscriptionBillingPeriod' }, select: { value: true } })
  const value = setting?.value
  const billingPeriod = typeof value === 'string' && ['MONTHLY', 'TERM', 'YEAR'].includes(value)
    ? value as BillingPeriod : fee.billingPeriod
  return { ...fee, billingPeriod }
}

export async function getGraceDays() {
  const setting = await prisma.setting.findUnique({ where: { key: 'graceDays' } })
  const rawValue = setting?.value
  const numeric = typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' ? Number(rawValue) : 7
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 7
}

export function getSubscriptionPeriodRange(date: Date, billingPeriod: BillingPeriod | null = 'MONTHLY') {
  const [year, month] = nairobiDateKey(date).split('-').map(Number)
  const nextPeriod = (nextYear: number, nextMonth: number) => {
    const first = new Date(Date.UTC(nextYear, nextMonth - 1, 1))
    return parseNairobiDate(`${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-01`)
  }

  if (billingPeriod === 'YEAR') {
    const start = parseNairobiDate(`${year}-01-01`)
    const end = parseNairobiDate(`${year + 1}-01-01`)
    return { start, end: new Date(end.getTime() - 1) }
  }

  if (billingPeriod === 'TERM') {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1
    const start = nextPeriod(year, startMonth)
    const end = nextPeriod(year, startMonth + 3)
    return { start, end: new Date(end.getTime() - 1) }
  }

  const start = nextPeriod(year, month)
  const end = nextPeriod(year, month + 1)
  return { start, end: new Date(end.getTime() - 1) }
}

export async function getMemberSubscriptionStatus(memberId: string, date = new Date()): Promise<SubscriptionStatus> {
  const latest = await prisma.payment.findFirst({
    where: { memberId, type: 'SUBSCRIPTION', status: 'SUCCESS' },
    orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
  })

  if (!latest) return 'DUE'

  const periodEnd = latest.periodEnd ?? latest.paidAt ?? new Date()
  const graceDays = await getGraceDays()
  const graceEnd = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000)

  if (date <= periodEnd) return 'PAID'
  if (date <= graceEnd) return 'DUE'
  return 'OVERDUE'
}
