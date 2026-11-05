import 'server-only'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { type BillingPeriod, type FeeType, type PaymentMethod, type Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { lockRow } from '@/lib/row-lock'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { getSubscriptionPeriodRange, resolveMemberFeeType } from '@/lib/fees'
import { memberDetailsRepository } from '@/modules/members/repository'
import { syncCurrentSeasonMemberStatus } from '@/modules/seasons/service'
import { financeRepository, seasonPaymentsRepository } from './repository'
import { isPaymentWithinSeason } from './rules'
import {
  getPayHeroTransactionStatus,
  initiatePayHeroCheckout,
  isPayHeroConfigured,
  PayHeroError,
} from './payhero-client'

export class FinanceServiceError extends Error {}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'MONTHLY' || value === 'TERM' || value === 'YEAR'
}

function effectiveBillingPeriod(setting: { value: Prisma.JsonValue } | null, fee: { billingPeriod: BillingPeriod | null } | null) {
  return isBillingPeriod(setting?.value) ? setting.value : fee?.billingPeriod ?? 'MONTHLY'
}

export async function recordManualPayment(input: {
  memberId: string
  type?: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING'
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
    const type = input.type ?? resolveMemberFeeType(member.status)
    if (!type || (type === 'REGISTRATION' && member.status !== 'PENDING_REGISTRATION')
      || (type === 'SUBSCRIPTION' && member.status !== 'ACTIVE')
      || (type === 'RETREAT_BONDING' && !['ACTIVE', 'PENDING_REGISTRATION'].includes(member.status))) {
      throw new FinanceServiceError('This member is not eligible for this fee payment right now.')
    }
    if (await financeRepository.hasPendingMemberPayment(tx, member.id, type)) {
      throw new FinanceServiceError('This member already has a payment claim awaiting review.')
    }
    if (await financeRepository.findPaymentByReference(tx, member.id, type, input.reference.trim())) {
      throw new FinanceServiceError('A payment with this reference has already been recorded.')
    }
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
    if (type !== 'RETREAT_BONDING') {
      await recordSeasonPayment(tx, { paymentId: payment.id, memberId: member.id, paidAt, amount: fee.amount })
    }
    if (type === 'REGISTRATION') {
      await financeRepository.activateMember(tx, member.id, paidAt)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
      await memberDetailsRepository.recordStatusChange(tx, member.id, member.status, 'ACTIVE', paidAt)
    } else if (type === 'SUBSCRIPTION') {
      await financeRepository.activateMember(tx, member.id)
      await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
    }
    await writeAuditLog(tx, {
      actorId,
      action: 'PAYMENT_RECORDED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: member.id, type, amount: fee.amount, method: input.method, reference: input.reference, reason: input.reason ?? '', source: 'ADMIN_MANUAL' },
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
      await memberDetailsRepository.recordStatusChange(tx, member.id, member.status, 'ACTIVE', paidAt)
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
      billingPeriod: input.type === 'SUBSCRIPTION' ? input.billingPeriod : null,
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

export async function submitMemberPayment(input: {
  memberId: string
  type: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING'
  method: PaymentMethod
  reference: string
}, actorId: string) {
  const idempotencyKey = createHash('sha256')
    .update(`${input.memberId}:${input.type}:${input.reference.trim().toUpperCase()}`)
    .digest('hex')

  return financeRepository.transaction(async (tx) => {
    await lockRow(tx, 'Member', input.memberId)
    const member = await financeRepository.memberForPayment(tx, input.memberId)
    if (!member) throw new FinanceServiceError('Member not found.')
    if ((input.type === 'REGISTRATION' && member.status !== 'PENDING_REGISTRATION')
      || (input.type === 'SUBSCRIPTION' && member.status !== 'ACTIVE')
      || (input.type === 'RETREAT_BONDING' && !['ACTIVE', 'PENDING_REGISTRATION'].includes(member.status))) {
      throw new FinanceServiceError('This member is not eligible to submit this fee payment.')
    }

    const existing = await financeRepository.findPaymentRequest(tx, idempotencyKey)
    if (existing) return { paymentId: existing.id, status: existing.status, duplicate: true }
    const recorded = await financeRepository.findPaymentByReference(tx, member.id, input.type, input.reference.trim())
    if (recorded) return { paymentId: recorded.id, status: recorded.status, duplicate: true }

    const pending = await financeRepository.hasPendingMemberPayment(tx, member.id, input.type)
    if (pending) throw new FinanceServiceError('You already have a payment awaiting committee review for this fee.')

    if (input.type === 'SUBSCRIPTION') {
      const latest = await financeRepository.latestSuccessfulSubscription(tx, member.id)
      const periodEnd = latest?.periodEnd ?? latest?.paidAt
      const graceDays = await getGraceDaysForTransaction(tx)
      if (periodEnd && Date.now() <= periodEnd.getTime() + graceDays * 86400000) {
        throw new FinanceServiceError('Your subscription is already paid for the current period.')
      }
    }

    const at = new Date()
    const fee = await financeRepository.effectiveFee(tx, input.type, at)
    if (!fee) throw new FinanceServiceError('This fee has not been set. Please contact the committee.')
    const payment = await financeRepository.createPaymentRequest(tx, {
      memberId: member.id,
      type: input.type,
      amount: fee.amount,
      status: 'PENDING',
      method: input.method,
      reference: input.reference.trim(),
      source: 'MEMBER_REPORTED',
      idempotencyKey,
      recordedById: actorId,
      resultDesc: 'Member reported payment; awaiting committee verification.',
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'MEMBER_PAYMENT_SUBMITTED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: member.id, type: input.type, amount: fee.amount, method: input.method, reference: input.reference.trim() },
    })
    return { paymentId: payment.id, status: payment.status, duplicate: false }
  })
}

export async function initiatePayHeroMemberPayment(input: {
  memberId: string
  type: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING'
  phone: string
}, actorId: string) {
  if (!isPayHeroConfigured()) throw new FinanceServiceError('Online M-Pesa checkout is not configured. Please contact the committee.')
  const phone = input.phone.trim()
  const reference = `EDC-${randomUUID().replaceAll('-', '').toUpperCase()}`
  const idempotencyKey = createHash('sha256').update(`PAYHERO:${reference}`).digest('hex')

  const checkout = await financeRepository.transaction(async (tx) => {
    await lockRow(tx, 'Member', input.memberId)
    const member = await financeRepository.memberForPayment(tx, input.memberId)
    if (!member) throw new FinanceServiceError('Member not found.')
    if ((input.type === 'REGISTRATION' && member.status !== 'PENDING_REGISTRATION')
      || (input.type === 'SUBSCRIPTION' && member.status !== 'ACTIVE')
      || (input.type === 'RETREAT_BONDING' && !['ACTIVE', 'PENDING_REGISTRATION'].includes(member.status))) {
      throw new FinanceServiceError('This member is not eligible to pay this fee.')
    }

    const pending = await financeRepository.hasPendingMemberPayment(tx, member.id, input.type)
    if (pending) return { paymentId: pending.id, duplicate: true as const }

    if (input.type === 'SUBSCRIPTION') {
      const latest = await financeRepository.latestSuccessfulSubscription(tx, member.id)
      const periodEnd = latest?.periodEnd ?? latest?.paidAt
      const graceDays = await getGraceDaysForTransaction(tx)
      if (periodEnd && Date.now() <= periodEnd.getTime() + graceDays * 86400000) {
        throw new FinanceServiceError('Your subscription is already paid for the current period.')
      }
    }

    const fee = await financeRepository.effectiveFee(tx, input.type, new Date())
    if (!fee) throw new FinanceServiceError('This fee has not been set. Please contact the committee.')
    const payment = await financeRepository.createPaymentRequest(tx, {
      memberId: member.id,
      type: input.type,
      amount: fee.amount,
      status: 'PENDING',
      method: 'MPESA',
      phone,
      reference,
      source: 'PAYHERO_CHECKOUT',
      idempotencyKey,
      recordedById: actorId,
      resultDesc: 'PayHero M-Pesa checkout is being initiated.',
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'PAYHERO_CHECKOUT_STARTED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: member.id, type: input.type, amount: fee.amount, reference },
    })
    return {
      paymentId: payment.id,
      duplicate: false as const,
      amount: fee.amount,
      memberName: member.fullName,
    }
  })

  if (checkout.duplicate) return { paymentId: checkout.paymentId, duplicate: true }

  try {
    const checkoutRequestId = await initiatePayHeroCheckout({
      amount: checkout.amount,
      phone,
      reference,
      customerName: checkout.memberName,
    })
    await financeRepository.transaction((tx) => financeRepository.updatePayHeroCheckout(
      tx,
      checkout.paymentId,
      checkoutRequestId,
      'M-Pesa prompt sent. Waiting for PayHero confirmation.',
    ))
    return { paymentId: checkout.paymentId, duplicate: false }
  } catch (error) {
    if (error instanceof PayHeroError && error.rejected) {
      await financeRepository.transaction(async (tx) => {
        await lockRow(tx, 'Payment', checkout.paymentId)
        await financeRepository.failPendingPayHeroCheckout(tx, checkout.paymentId, {
          status: 'FAILED',
          resultDesc: 'PayHero rejected the checkout request.',
        })
      })
    }
    if (error instanceof PayHeroError) throw new FinanceServiceError(error.message)
    throw error
  }
}

export async function processPayHeroCallback(reference: string) {
  const existing = await financeRepository.transaction((tx) => financeRepository.findPayHeroPayment(tx, reference))
  if (!existing) throw new FinanceServiceError('PayHero payment was not found.')
  if (existing.source !== 'PAYHERO_CHECKOUT' && existing.source !== 'PROVIDER_VERIFIED') {
    throw new FinanceServiceError('This is not a PayHero checkout.')
  }
  const authoritativeStatus = await getPayHeroTransactionStatus(reference)
  if (authoritativeStatus.reference !== reference) throw new FinanceServiceError('PayHero transaction reference did not match.')

  return financeRepository.transaction(async (tx) => {
    const candidate = await financeRepository.findPayHeroPayment(tx, reference)
    if (!candidate) throw new FinanceServiceError('PayHero payment was not found.')
    await lockRow(tx, 'Payment', candidate.id)
    const payment = await financeRepository.findPayHeroPayment(tx, reference)
    if (!payment) throw new FinanceServiceError('PayHero payment was not found.')
    if (payment.status !== 'PENDING') {
      return { paymentId: payment.id, status: payment.status, duplicate: true }
    }
    if (payment.source !== 'PAYHERO_CHECKOUT') throw new FinanceServiceError('This payment is not a pending PayHero checkout.')

    if (authoritativeStatus.status === 'PENDING') {
      return { paymentId: payment.id, status: payment.status, duplicate: false }
    }

    if (authoritativeStatus.status === 'SUCCESS') {
      if (authoritativeStatus.amount !== payment.amount || !authoritativeStatus.receipt) {
        throw new FinanceServiceError('PayHero confirmation did not include a matching amount and receipt.')
      }
      const paidAt = new Date()
      const member = await financeRepository.memberForPayment(tx, payment.memberId)
      if (!member) throw new FinanceServiceError('Member not found.')

      let periodStart: Date | null = null
      let periodEnd: Date | null = null
      if (payment.type === 'SUBSCRIPTION') {
        const fee = await financeRepository.effectiveFee(tx, 'SUBSCRIPTION', paidAt)
        const setting = await financeRepository.billingPeriodSetting(tx)
        const range = getSubscriptionPeriodRange(paidAt, effectiveBillingPeriod(setting, fee))
        periodStart = range.start
        periodEnd = range.end
      }
      if (payment.type !== 'RETREAT_BONDING') {
        await recordSeasonPayment(tx, { paymentId: payment.id, memberId: payment.memberId, paidAt, amount: payment.amount })
      }
      if (payment.type === 'REGISTRATION' && member.status === 'PENDING_REGISTRATION') {
        await financeRepository.activateMember(tx, member.id, paidAt)
        await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
        await memberDetailsRepository.recordStatusChange(tx, member.id, member.status, 'ACTIVE', paidAt)
      } else if (payment.type === 'SUBSCRIPTION' && member.status === 'ACTIVE') {
        await syncCurrentSeasonMemberStatus(tx, member.id, 'ACTIVE')
      }

      await financeRepository.updatePaymentReview(tx, payment.id, {
        status: 'SUCCESS',
        source: 'PROVIDER_VERIFIED',
        paidAt,
        periodStart,
        periodEnd,
        mpesaReceipt: authoritativeStatus.receipt,
        resultDesc: authoritativeStatus.description,
      })
      await writeAuditLog(tx, {
        actorId: payment.recordedById,
        action: 'PAYHERO_PAYMENT_VERIFIED',
        entity: 'Payment',
        entityId: payment.id,
        details: {
          memberId: payment.memberId,
          type: payment.type,
          amount: payment.amount,
          reference,
          receipt: authoritativeStatus.receipt,
          verifiedBy: 'PayHero transaction-status API',
        },
      })
      return { paymentId: payment.id, status: 'SUCCESS' as const, duplicate: false }
    }

    await financeRepository.updatePaymentReview(tx, payment.id, {
      status: authoritativeStatus.status,
      resultDesc: authoritativeStatus.description,
    })
    await writeAuditLog(tx, {
      actorId: payment.recordedById,
      action: 'PAYHERO_PAYMENT_NOT_COMPLETED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: payment.memberId, type: payment.type, reference, status: authoritativeStatus.status },
    })
    return { paymentId: payment.id, status: authoritativeStatus.status, duplicate: false }
  })
}

async function getGraceDaysForTransaction(tx: Prisma.TransactionClient) {
  const setting = await tx.setting.findUnique({ where: { key: 'graceDays' }, select: { value: true } })
  const raw = setting?.value
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 7
  return Number.isFinite(value) && value >= 0 ? value : 7
}

export async function reviewMemberPayment(input: {
  paymentId: string
  decision: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  reason: string
}, actorId: string) {
  const reviewedAt = new Date()
  return financeRepository.transaction(async (tx) => {
    await lockRow(tx, 'Payment', input.paymentId)
    const payment = await financeRepository.paymentForReview(tx, input.paymentId)
    if (!payment || payment.source !== 'MEMBER_REPORTED') throw new FinanceServiceError('Member payment claim not found.')
    if (payment.status !== 'PENDING') throw new FinanceServiceError('This payment claim has already been reviewed.')

    let periodStart: Date | null = null
    let periodEnd: Date | null = null
    if (input.decision === 'SUCCESS') {
      const member = await financeRepository.memberForPayment(tx, payment.memberId)
      if (!member) throw new FinanceServiceError('Member not found.')
      if ((payment.type === 'REGISTRATION' && member.status !== 'PENDING_REGISTRATION')
        || (payment.type === 'SUBSCRIPTION' && member.status !== 'ACTIVE')) {
        throw new FinanceServiceError('The member status no longer permits approval of this fee.')
      }
      if (payment.type === 'SUBSCRIPTION') {
        const fee = await financeRepository.effectiveFee(tx, 'SUBSCRIPTION', reviewedAt)
        const setting = await financeRepository.billingPeriodSetting(tx)
        const billingPeriod = effectiveBillingPeriod(setting, fee)
        const range = getSubscriptionPeriodRange(reviewedAt, billingPeriod)
        periodStart = range.start
        periodEnd = range.end
      }

      if (payment.type !== 'RETREAT_BONDING') {
        await recordSeasonPayment(tx, {
          paymentId: payment.id,
          memberId: payment.memberId,
          paidAt: reviewedAt,
          amount: payment.amount,
        })
      }
      if (payment.type === 'REGISTRATION') {
        await financeRepository.activateMember(tx, payment.memberId, reviewedAt)
        await syncCurrentSeasonMemberStatus(tx, payment.memberId, 'ACTIVE')
        await memberDetailsRepository.recordStatusChange(tx, payment.memberId, member.status, 'ACTIVE', reviewedAt)
      } else if (payment.type === 'SUBSCRIPTION') {
        await financeRepository.activateMember(tx, payment.memberId)
        await syncCurrentSeasonMemberStatus(tx, payment.memberId, 'ACTIVE')
      }
    }

    await financeRepository.updatePaymentReview(tx, payment.id, {
      status: input.decision,
      paidAt: input.decision === 'SUCCESS' ? reviewedAt : null,
      periodStart,
      periodEnd,
      resultDesc: input.reason,
    })
    await writeAuditLog(tx, {
      actorId,
      action: input.decision === 'SUCCESS'
        ? 'MEMBER_PAYMENT_VERIFIED'
        : input.decision === 'CANCELLED' ? 'MEMBER_PAYMENT_CANCELLED' : 'MEMBER_PAYMENT_REJECTED',
      entity: 'Payment',
      entityId: payment.id,
      details: { memberId: payment.memberId, type: payment.type, amount: payment.amount, method: payment.method, reference: payment.reference, decision: input.decision, reason: input.reason },
    })
    return { paymentId: payment.id, status: input.decision }
  })
}

export async function listMemberPaymentHistory(memberId: string) {
  return financeRepository.memberPaymentHistory(memberId)
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
