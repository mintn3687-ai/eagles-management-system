'use server'

import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'
import { feeSettingInputSchema } from '@/lib/validation/fees'
import { createFeeSetting, FinanceServiceError } from '@/modules/finance/service'

export async function saveFeeSettingAction(formData: FormData) {
  const actor = await requirePermission('fees:manage')
  const raw = {
    type: String(formData.get('type') ?? ''),
    amount: formData.get('amount') ?? '',
    billingPeriod: String(formData.get('billingPeriod') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  }

  const parsed = feeSettingInputSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Check the fee details and try again.'
    redirect(`/admin/fees?error=${encodeURIComponent(issue)}`)
  }

  const data = parsed.data
  try {
    await createFeeSetting(data, actor.id)
  } catch (error) {
    const message = error instanceof FinanceServiceError
      ? error.message : 'Could not update fee settings. Please try again.'
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`)
  }

  redirect('/admin/fees?success=' + encodeURIComponent('The fee history was updated with a new effective setting.'))
}
