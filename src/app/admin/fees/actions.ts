'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentFee } from '@/lib/fees'
import { requireRole } from '@/lib/permissions'
import { feeSettingInputSchema } from '@/lib/validation/fees'

export async function saveFeeSettingAction(formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN')
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
  const existing = await getCurrentFee(data.type === 'REGISTRATION' ? 'REGISTRATION' : 'SUBSCRIPTION')
  if (!existing && data.amount <= 0) {
    redirect('/admin/fees?error=' + encodeURIComponent('Enter a valid fee amount.'))
  }

  const effectiveFrom = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.feeSetting.create({
      data: {
        type: data.type,
        amount: data.amount,
        billingPeriod: data.type === 'REGISTRATION' ? null : data.billingPeriod,
        effectiveFrom,
        reason: data.reason,
        createdById: actor.id,
      },
    })

    if (data.type === 'SUBSCRIPTION' && data.billingPeriod) {
      await tx.setting.upsert({
        where: { key: 'subscriptionBillingPeriod' },
        update: { value: data.billingPeriod },
        create: { key: 'subscriptionBillingPeriod', value: data.billingPeriod },
      })
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'FEE_SETTING_CHANGED',
        entity: 'FeeSetting',
        entityId: `${data.type}-${effectiveFrom.toISOString()}`,
        details: { type: data.type, amount: data.amount, billingPeriod: data.billingPeriod, reason: data.reason },
      },
    })
  })

  redirect('/admin/fees?success=' + encodeURIComponent('The fee history was updated with a new effective setting.'))
}
