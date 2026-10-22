'use server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireUser, isRestricted } from '@/lib/permissions'
import { consentSchema } from '@/lib/validation/auth'
import type { FormState } from '@/lib/form-state'

export async function acceptConsentAction(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser()
  if (isRestricted(user)) redirect('/member')
  const parsed = consentSchema.safeParse({ consent: form.get('consent') })
  if (!parsed.success) return { error: 'Tick the checkbox to continue.' }
  await prisma.user.updateMany({ where: { id: user.id, consentAcceptedAt: null }, data: { consentAcceptedAt: new Date() } })
  redirect(user.role === 'MEMBER' ? '/member' : '/admin')
}
