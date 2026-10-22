'use server'

import { redirect } from 'next/navigation'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/permissions'
import { manualPaymentSchema, waiveFeeSchema } from '@/lib/validation/fees'
import { FinanceServiceError, recordManualPayment, waiveMemberFee } from '@/modules/finance/service'

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof FinanceServiceError ? error.message : fallback
}

export async function recordManualPaymentAction(formData: FormData) {
  const actor = await requirePermission('payments:manage')
  const parsed = manualPaymentSchema.safeParse({
    memberId: field(formData, 'memberId'),
    method: field(formData, 'method'),
    reference: field(formData, 'reference'),
    paymentDate: field(formData, 'date'),
    reason: field(formData, 'reason'),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Check the payment details and try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(issue)}`)
  }

  const rateLimit = await consumeRateLimit('payment-record', `${actor.id}:${parsed.data.memberId}`, 10, 60 * 60_000)
  if (!rateLimit.allowed) {
    redirect(`/admin/payments?error=${encodeURIComponent('Too many payments recorded for this member. Please try again later.')}`)
  }

  let errorMessage = ''
  try {
    await recordManualPayment(parsed.data, actor.id)
  } catch (error) {
    errorMessage = failureMessage(error, 'Could not record this payment. Please try again.')
  }
  if (errorMessage) redirect(`/admin/payments?error=${encodeURIComponent(errorMessage)}`)
  redirect('/admin/payments?success=' + encodeURIComponent('The payment was recorded successfully.'))
}

export async function waiveFeeAction(formData: FormData) {
  const actor = await requirePermission('payments:manage')
  const parsed = waiveFeeSchema.safeParse({
    memberId: field(formData, 'memberId'),
    reason: field(formData, 'reason'),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Add the waiver reason and try again.'
    redirect(`/admin/payments?error=${encodeURIComponent(issue)}`)
  }

  let errorMessage = ''
  try {
    await waiveMemberFee(parsed.data, actor.id)
  } catch (error) {
    errorMessage = failureMessage(error, 'Could not waive this fee. Please try again.')
  }
  if (errorMessage) redirect(`/admin/payments?error=${encodeURIComponent(errorMessage)}`)
  redirect('/admin/payments?success=' + encodeURIComponent('The fee was waived and recorded as a successful payment.'))
}
