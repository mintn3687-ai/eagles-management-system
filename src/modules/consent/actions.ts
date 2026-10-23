'use server'

import { redirect } from 'next/navigation'
import { isRestricted, requireUser } from '@/lib/permissions'
import type { FormState } from '@/lib/form-state'
import { consentSchema } from './schema'
import { acceptConsent } from './service'

export async function acceptConsentAction(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser()
  if (isRestricted(user)) redirect('/member')
  const parsed = consentSchema.safeParse({ consent: form.get('consent') })
  if (!parsed.success) return { error: 'Tick the checkbox to continue.' }
  await acceptConsent(user.id)
  redirect(user.role === 'MEMBER' ? '/member' : '/admin')
}
