import 'server-only'
import { randomUUID } from 'node:crypto'
import { type BillingPeriod, type FeeType, type PaymentMethod, type Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { lockRow } from '@/lib/row-lock'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { getSubscriptionPeriodRange, resolveMemberFeeType } from '@/lib/fees'
import { recordMemberStatusChange } from '@/lib/members/status-history'
import { syncCurrentSeasonMemberStatus } from '@/modules/seasons/service'
import { financeRepository, seasonPaymentsRepository } from './repository'
import { isPaymentWithinSeason } from './rules'

export class FinanceServiceError extends Error {}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'MONTHLY' || value === 'TERM' || value === 'YEAR'
}

function effectiveBillingPeriod(setting: { value: Prisma.JsonValue } | null, fee: { billingPeriod: BillingPeriod | null } | null) {
  return isBillingPeriod(setting?.value) ? setting.value : fee?.billingPeriod ?? 'MONTHLY'
}

export async function recordManualPayment(input: {
  memberId: string
  method: Extract<PaymentMethod, 'CASH' | 'OTHER'>
  reference: string
  paymentDate: string
  reason?: string
}, actorId: string) {
  if (input.paymentDate > nairobiDateKey()) throw new FinanceServiceError('Payment date cannot be in the future.')
  const paidAt = parseNairobiDate(input.paymentDate)
  return financeRepository.transaction(async (tx) => {
    await lockRow(tx, 'Member', input.memberId)
    const member = await financeRepository.memberForPayment(tx, input.memberId)
    if (!member) throw new FinanceServiceError('Member not found.')
    const type = resolveMemberFeeType(member.status)
    if (!type) throw new FinanceServiceError('This member is not eligible for a fee payment right now.')
    const fee = await financeRepository.effectiveFee(tx, type, paidAt)
    if (!fee) throw new FinanceServiceError('Set a fee amount before recording a payment.')
    const setting = type === 'SUBSCRIPTION' ? await financeRepository.billingPeriodSetting(tx) : null
    const billingPeriod = effectiveBillingPeriod(setting, fee)
    const periodRange = type === 'SUBSCRIPTION' ? getSubscriptionPeriodRange(paidAt, billingPeriod) : null
    const payment = await financeRepository.createPayment(tx, {
      memberId: member.id,
      type,
      amount: fee.amount,
      status: 'SUCCESS',
      method: input.method,
      reference: input.reference,
      recordedById: actorId,
      paidAt,
      periodStart: periodRange?.start ?? null,
      periodEnd: periodRange?.end ?? null,
      resultDesc: input.reason || 'Manual payment recorded by committee.',
    })
    await recordSeasonPayment(tx, { paymentId: payment.id, memberId: member.id, paidAt, amount: fee.amount })
    if (type === 'REGISTRATION') {
      await financeRepository.activateMember(tx, member.id, paidAt)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
      await recordMemberStatusChange(tx, member.id, member.status, 'ACTIVE', paidAt)
    } else {
      await financeRepository.activateMember(tx, member.id)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
    }
    await writeAuditLog(tx, {
      actorId,
      action: 'PAYMENT_RECORDED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: member.id, type, amount: fee.amount, method: input.method, reference: input.reference, reason: input.reason ?? '' },
    })
    return { paymentId: payment.id }
  })
}

export async function waiveMemberFee(input: { memberId: string; reason: string }, actorId: string) {
  const paidAt = new Date()
  return financeRepository.transaction(async (tx) => {
    await lockRow(tx, 'Member', input.memberId)
    const member = await financeRepository.memberForPayment(tx, input.memberId)
    if (!member) throw new FinanceServiceError('Member not found.')
    const type = resolveMemberFeeType(member.status)
    if (!type) throw new FinanceServiceError('This member is not eligible for a fee waiver right now.')
    const fee = await financeRepository.effectiveFee(tx, type, paidAt)
    const setting = type === 'SUBSCRIPTION' ? await financeRepository.billingPeriodSetting(tx) : null
    const periodRange = type === 'SUBSCRIPTION'
      ? getSubscriptionPeriodRange(paidAt, effectiveBillingPeriod(setting, fee))
      : null
    const payment = await financeRepository.createPayment(tx, {
      memberId: member.id,
      type,
      amount: 0,
      status: 'SUCCESS',
      method: 'OTHER',
      reference: `WAIVE-${randomUUID()}`,
      recordedById: actorId,
      paidAt,
      periodStart: periodRange?.start ?? null,
      periodEnd: periodRange?.end ?? null,
      resultDesc: input.reason,
    })
    await recordSeasonPayment(tx, { paymentId: payment.id, memberId: member.id, paidAt, amount: 0 })
    if (type === 'REGISTRATION') {
      await financeRepository.activateMember(tx, member.id, paidAt)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
      await recordMemberStatusChange(tx, member.id, member.status, 'ACTIVE', paidAt)
    } else {
      await financeRepository.activateMember(tx, member.id)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
    }
    await writeAuditLog(tx, {
      actorId,
      action: 'FEE_WAIVED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: member.id, type, reason: input.reason },
    })
    return { paymentId: payment.id }
  })
}

export async function createFeeSetting(input: {
  type: FeeType
  amount: number
  billingPeriod: BillingPeriod | null
  reason: string
}, actorId: string) {
  const effectiveFrom = new Date()
  return financeRepository.transaction(async (tx) => {
    const setting = await financeRepository.createFeeSetting(tx, {
      type: input.type,
      amount: input.amount,
      billingPeriod: input.type === 'REGISTRATION' ? null : input.billingPeriod,
      effectiveFrom,
      reason: input.reason,
      createdById: actorId,
    })
    if (input.type === 'SUBSCRIPTION' && input.billingPeriod) {
      await financeRepository.saveSubscriptionBillingPeriod(tx, input.billingPeriod)
    }
    await writeAuditLog(tx, {
      actorId,
      action: 'FEE_SETTING_CHANGED',
      entity: 'FeeSetting',
      entityId: setting.id,
      details: { type: input.type, amount: input.amount, billingPeriod: input.billingPeriod, reason: input.reason },
    })
    return { feeSettingId: setting.id }
  })
}

export async function recordSeasonPayment(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; memberId: string; paidAt: Date; amount: number },
) {
  const seasonDate = parseNairobiDate(nairobiDateKey(input.paidAt))
  const season = await seasonPaymentsRepository.findSeasonAt(tx, seasonDate)
  if (!season || !isPaymentWithinSeason(input.paidAt, season.startDate, season.endDate)) return

  await seasonPaymentsRepository.assignPaymentToSeason(tx, input.paymentId, season.id)
  await seasonPaymentsRepository.upsertMembershipPayment(tx, {
    seasonId: season.id,
    memberId: input.memberId,
    amount: input.amount,
  })
}
