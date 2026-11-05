'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'
import { paymentEventCreateSchema, paymentEventStatusSchema } from '@/lib/validation/fees'
import {
  createPaymentEvent,
  FinanceServiceError,
  setPaymentEventStatus,
} from '@/modules/finance/service'

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function createPaymentEventAction(formData: FormData) {
  const actor = await requirePermission('payments:manage')
  const parsed = paymentEventCreateSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    amount: field(formData, 'amount'),
    paymentDeadline: field(formData, 'paymentDeadline'),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the event payment details.'
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }

  try {
    await createPaymentEvent(parsed.data, actor.id)
  } catch (error) {
    let message = 'Could not create the event payment.'
    if (error instanceof FinanceServiceError) message = error.message
    else console.error('Could not create event payment.', error)
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }
  revalidatePath('/member/fees')
  redirect(`/admin/payments?success=${encodeURIComponent('Event payment created. Eligible members can now pay it from their Payments page.')}`)
}

export async function setPaymentEventStatusAction(formData: FormData) {
  const actor = await requirePermission('payments:manage')
  const parsed = paymentEventStatusSchema.safeParse({
    eventId: field(formData, 'eventId'),
    status: field(formData, 'status'),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the event payment status.'
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }

  try {
    await setPaymentEventStatus(parsed.data, actor.id)
  } catch (error) {
    let message = 'Could not update the event payment.'
    if (error instanceof FinanceServiceError) message = error.message
    else console.error('Could not update event payment status.', error)
    redirect(`/admin/payments?error=${encodeURIComponent(message)}`)
  }
  revalidatePath('/member/fees')
  redirect(`/admin/payments?success=${encodeURIComponent(parsed.data.status === 'OPEN' ? 'Event payment reopened.' : 'Event payment closed.')}`)
}
