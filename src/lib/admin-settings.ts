import 'server-only'
import { BillingPeriod } from '@prisma/client'
import { prisma } from '@/lib/db'
import { clubSettingsSchema, type ClubSettings } from '@/lib/validation/admin'

export const defaultClubSettings: ClubSettings = {
  clubName: 'Eagles Drama Club',
  attendanceThreshold: 60,
  absenceDeadlineHours: 48,
  graceDays: 7,
  subscriptionBillingPeriod: 'MONTHLY',
}

export async function getClubSettings(): Promise<ClubSettings> {
  const [rows, subscriptionFee] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: Object.keys(defaultClubSettings) } }, select: { key: true, value: true } }),
    prisma.feeSetting.findFirst({ where: { type: 'SUBSCRIPTION', effectiveFrom: { lte: new Date() } }, orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }], select: { billingPeriod: true } }),
  ])
  const values = new Map(rows.map((row) => [row.key, row.value]))
  const numberValue = (key: 'attendanceThreshold' | 'absenceDeadlineHours' | 'graceDays') => {
    const raw = values.get(key)
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isInteger(n) ? n : defaultClubSettings[key]
  }
  const clubName = values.get('clubName')
  const period = values.get('subscriptionBillingPeriod')
  const result = clubSettingsSchema.safeParse({
    clubName: typeof clubName === 'string' && clubName.trim() ? clubName : defaultClubSettings.clubName,
    attendanceThreshold: numberValue('attendanceThreshold'),
    absenceDeadlineHours: numberValue('absenceDeadlineHours'),
    graceDays: numberValue('graceDays'),
    subscriptionBillingPeriod: typeof period === 'string' && Object.values(BillingPeriod).includes(period as BillingPeriod)
      ? period : subscriptionFee?.billingPeriod ?? defaultClubSettings.subscriptionBillingPeriod,
  })
  return result.success ? result.data : defaultClubSettings
}
