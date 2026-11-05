'use server'

import { redirect } from 'next/navigation'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requireRole } from '@/lib/permissions'
import { memberPaymentRequestSchema, payHeroCheckoutSchema, payHeroEventCheckoutSchema } from '@/lib/validation/fees'
import {
  FinanceServiceError,
  initiatePayHeroEventPayment,
  initiatePayHeroMemberPayment,
  submitMemberPayment,
} from '@/modules/finance/service'

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

  let result: Awaited<ReturnType<typeof submitMemberPayment>>
  try {
    result = await submitMemberPayment({
      memberId: actor.member.id,
      type: parsed.data.type,
      method: parsed.data.method,
      reference: parsed.data.reference,
    }, actor.id)
  } catch (error) {
    const message = error instanceof FinanceServiceError
      ? error.message
      : 'Could not submit the payment for review. Please try again.'
    redirect(`/member/fees?error=${encodeURIComponent(message)}`)
  }
  const message = result.duplicate
    ? 'This payment reference was already submitted. Check the payment history below.'
    : 'Payment reported. It will remain pending until the committee verifies it.'
  redirect(`/member/fees?success=${encodeURIComponent(message)}`)
}

export async function startPayHeroCheckoutAction(formData: FormData) {
  const actor = await requireRole('MEMBER')
  if (!actor.member) redirect('/forbidden')

  const parsed = payHeroCheckoutSchema.safeParse({
    type: value(formData, 'type'),
    phone: value(formData, 'phone'),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the phone number and try again.'
    redirect(`/member/fees?error=${encodeURIComponent(message)}`)
  }

  const rateLimit = await consumeRateLimit('member-payhero-checkout', actor.member.id, 3, 60 * 60_000)
  if (!rateLimit.allowed) {
    redirect(`/member/fees?error=${encodeURIComponent('Too many M-Pesa prompts. Please wait before trying again.')}`)
  }

  let result: Awaited<ReturnType<typeof initiatePayHeroMemberPayment>>
  try {
    result = await initiatePayHeroMemberPayment({
      memberId: actor.member.id,
      type: parsed.data.type,
      phone: parsed.data.phone,
    }, actor.id)
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      redirect(`/member/fees?error=${encodeURIComponent(error.message)}`)
    }
    console.error('Could not start PayHero checkout.', error)
    redirect(`/member/fees?error=${encodeURIComponent('Could not confirm the M-Pesa prompt. Check payment history before retrying.')}`)
  }
  const message = result.duplicate
    ? 'A payment for this fee is already pending. Check your payment history before retrying.'
    : 'M-Pesa prompt sent. Approve it on your phone; the payment will show as successful only after PayHero confirms it.'
  redirect(`/member/fees?success=${encodeURIComponent(message)}`)
}

export async function startPayHeroEventCheckoutAction(formData: FormData) {
  const actor = await requireRole('MEMBER')
  if (!actor.member) redirect('/forbidden')

  const parsed = payHeroEventCheckoutSchema.safeParse({
    eventId: value(formData, 'eventId'),
    phone: value(formData, 'phone'),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the event payment details.'
    redirect(`/member/fees?error=${encodeURIComponent(message)}`)
  }

  const rateLimit = await consumeRateLimit('member-payhero-event-checkout', actor.member.id, 5, 60 * 60_000)
  if (!rateLimit.allowed) {
    redirect(`/member/fees?error=${encodeURIComponent('Too many event payment prompts. Please wait before trying again.')}`)
  }

  let result: Awaited<ReturnType<typeof initiatePayHeroEventPayment>>
  try {
    result = await initiatePayHeroEventPayment({
      memberId: actor.member.id,
      eventId: parsed.data.eventId,
      phone: parsed.data.phone,
    }, actor.id)
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      redirect(`/member/fees?error=${encodeURIComponent(error.message)}`)
    }
    console.error('Could not start PayHero event checkout.', error)
    redirect(`/member/fees?error=${encodeURIComponent('Could not start the event payment. Check your payment history before retrying.')}`)
  }
  const message = result.duplicate
    ? 'An M-Pesa prompt for this event is already pending. Check payment history before retrying.'
    : 'Event payment prompt sent. Approve it on your phone; success is recorded only after PayHero confirms it.'
  redirect(`/member/fees?success=${encodeURIComponent(message)}`)
}
