'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getSubscriptionPeriodRange, resolveMemberFeeType } from '@/lib/fees'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { requireRole } from '@/lib/permissions'
import { lockRow } from '@/lib/row-lock'
import { recordMemberStatusChange } from '@/lib/members/status-history'
import { manualPaymentSchema, waiveFeeSchema } from '@/lib/validation/fees'
import { consumeRateLimit } from '@/lib/rate-limit'

class PaymentActionError extends Error {}

export async function recordManualPaymentAction(formData: FormData) {
  const actor = await requireRole('COMMITTEE')
  const raw = {
    memberId: String(formData.get('memberId') ?? ''),
    method: String(formData.get('method') ?? ''),
    reference: String(formData.get('reference') ?? ''),
    paymentDate: String(formData.get('date') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  }

  const parsed = manualPaymentSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Check the payment details and try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(issue)}`)
  }

  const input = parsed.data
  const paymentRate = await consumeRateLimit('payment-record', `${actor.id}:${input.memberId}`, 10, 60 * 60_000)
  if (!paymentRate.allowed) redirect('/admin/payments?error=' + encodeURIComponent('Too many payments recorded for this member. Please try again later.'))
  if (input.paymentDate > nairobiDateKey()) {
    redirect('/admin/payments?error=' + encodeURIComponent('Payment date cannot be in the future.'))
  }
  const paymentDate = parseNairobiDate(input.paymentDate)
  try {
    await prisma.$transaction(async (tx) => {
      await lockRow(tx, 'Member', input.memberId)
      const member = await tx.member.findUnique({ where: { id: input.memberId }, select: { id: true, status: true } })
      if (!member) throw new PaymentActionError('Member not found.')
      const type = resolveMemberFeeType(member.status)
      if (!type) throw new PaymentActionError('This member is not eligible for a fee payment right now.')
      const fee = await tx.feeSetting.findFirst({
        where: { type, effectiveFrom: { lte: new Date() } },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      })
      const billingSetting = type === 'SUBSCRIPTION'
        ? await tx.setting.findUnique({ where: { key: 'subscriptionBillingPeriod' }, select: { value: true } })
        : null
      const billingPeriod = typeof billingSetting?.value === 'string' && ['MONTHLY', 'TERM', 'YEAR'].includes(billingSetting.value)
        ? billingSetting.value as 'MONTHLY' | 'TERM' | 'YEAR' : fee?.billingPeriod ?? 'MONTHLY'
      if (!fee) throw new PaymentActionError('Set a fee amount before recording a payment.')
      const amount = fee.amount
      const periodRange = type === 'SUBSCRIPTION' ? getSubscriptionPeriodRange(paymentDate, billingPeriod) : null
      const payment = await tx.payment.create({
        data: {
          memberId: member.id,
          type,
          amount,
          status: 'SUCCESS',
          method: input.method,
          reference: input.reference,
          recordedById: actor.id,
          paidAt: paymentDate,
          periodStart: periodRange?.start ?? null,
          periodEnd: periodRange?.end ?? null,
          resultDesc: input.reason || 'Manual payment recorded by committee.',
        },
      })

      if (type === 'REGISTRATION') {
        await tx.member.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', joinedAt: paymentDate },
        })
        await recordMemberStatusChange(tx, member.id, member.status, 'ACTIVE', paymentDate)
      }

      if (type === 'SUBSCRIPTION') {
        await tx.member.update({
          where: { id: member.id },
          data: { status: 'ACTIVE' },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'PAYMENT_RECORDED',
          entity: 'Payment',
          entityId: payment.id,
          details: { memberId: member.id, type, amount, method: input.method, reference: input.reference, reason: input.reason },
        },
      })
    })
  } catch (error) {
    const message = error instanceof PaymentActionError ? error.message : 'Could not record this payment. Please try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }

  redirect('/admin/payments?success=' + encodeURIComponent('The payment was recorded successfully.'))
}

export async function waiveFeeAction(formData: FormData) {
  const actor = await requireRole('COMMITTEE')
  const raw = {
    memberId: String(formData.get('memberId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  }

  const parsed = waiveFeeSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Add the waiver reason and try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(issue)}`)
  }

  const input = parsed.data
  const paymentDate = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      await lockRow(tx, 'Member', input.memberId)
      const member = await tx.member.findUnique({ where: { id: input.memberId }, select: { id: true, status: true } })
      if (!member) throw new PaymentActionError('Member not found.')
      const type = resolveMemberFeeType(member.status)
      if (!type) throw new PaymentActionError('This member is not eligible for a fee waiver right now.')
      const currentFee = await tx.feeSetting.findFirst({
        where: { type, effectiveFrom: { lte: paymentDate } },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      })
      const billingSetting = type === 'SUBSCRIPTION'
        ? await tx.setting.findUnique({ where: { key: 'subscriptionBillingPeriod' }, select: { value: true } })
        : null
      const billingPeriod = typeof billingSetting?.value === 'string' && ['MONTHLY', 'TERM', 'YEAR'].includes(billingSetting.value)
        ? billingSetting.value as 'MONTHLY' | 'TERM' | 'YEAR' : currentFee?.billingPeriod ?? 'MONTHLY'
      const periodRange = type === 'SUBSCRIPTION' ? getSubscriptionPeriodRange(paymentDate, billingPeriod) : null
      const payment = await tx.payment.create({
        data: {
          memberId: member.id,
          type,
          amount: 0,
          status: 'SUCCESS',
          method: 'OTHER',
          reference: `WAIVE-${Date.now()}`,
          recordedById: actor.id,
          paidAt: paymentDate,
          periodStart: periodRange?.start ?? null,
          periodEnd: periodRange?.end ?? null,
          resultDesc: input.reason,
        },
      })

      if (type === 'REGISTRATION') {
        await tx.member.update({ where: { id: member.id }, data: { status: 'ACTIVE', joinedAt: paymentDate } })
        await recordMemberStatusChange(tx, member.id, member.status, 'ACTIVE', paymentDate)
      }

      if (type === 'SUBSCRIPTION') {
        await tx.member.update({ where: { id: member.id }, data: { status: 'ACTIVE' } })
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'FEE_WAIVED',
          entity: 'Payment',
          entityId: payment.id,
          details: { memberId: member.id, type, reason: input.reason },
        },
      })
    })
  } catch (error) {
    const message = error instanceof PaymentActionError ? error.message : 'Could not waive this fee. Please try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }

  redirect('/admin/payments?success=' + encodeURIComponent('The fee was waived and recorded as a successful payment.'))
}
