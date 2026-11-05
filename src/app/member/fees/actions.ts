'use server'

import { redirect } from 'next/navigation'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requireRole } from '@/lib/permissions'
import { memberPaymentRequestSchema } from '@/lib/validation/fees'
import { FinanceServiceError, submitMemberPayment } from '@/modules/finance/service'

function value(formData: FormData, key: string) {
  const field = formData.get(key)
  return typeof field === 'string' ? field : ''
}

export async function submitMemberPaymentAction(formData: FormData) {
  const actor = await requireRole('MEMBER')
  if (!actor.member) redirect('/forbidden')

  const parsed = memberPaymentRequestSchema.safeParse({
    type: value(formData, 'type'),
    method: value(formData, 'method'),
    reference: value(formData, 'reference'),
    confirmPaid: value(formData, 'confirmPaid'),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check your payment details.'
    redirect(`/member/fees?error=${encodeURIComponent(message)}`)
  }

  const rateLimit = await consumeRateLimit('member-payment-request', actor.member.id, 5, 60 * 60_000)
  if (!rateLimit.allowed) {
    redirect(`/member/fees?error=${encodeURIComponent('Too many payment submissions. Please wait before trying again.')}`)
  }

  try {
    const result = await submitMemberPayment({
      memberId: actor.member.id,
      type: parsed.data.type,
      method: parsed.data.method,
      reference: parsed.data.reference,
    }, actor.id)
    const message = result.duplicate
      ? 'This payment reference was already submitted. Check the payment history below.'
      : 'Payment reported. It will remain pending until the committee verifies it.'
    redirect(`/member/fees?success=${encodeURIComponent(message)}`)
  } catch (error) {
    const message = error instanceof FinanceServiceError
      ? error.message
      : 'Could not submit the payment for review. Please try again.'
    redirect(`/member/fees?error=${encodeURIComponent(message)}`)
  }
}
