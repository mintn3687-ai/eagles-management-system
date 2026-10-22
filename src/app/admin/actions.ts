'use server'
import { createInvite, InviteError } from '@/lib/auth/create-invite'
import { AccessError, requireRole } from '@/lib/permissions'
import { inviteCreateSchema } from '@/lib/validation/auth'
import type { FormState } from '@/lib/form-state'

export async function createInviteAction(_previous: FormState, form: FormData): Promise<FormState> {
  try {
    await requireRole('COMMITTEE')
    const parsed = inviteCreateSchema.safeParse({ userId: form.get('userId') })
    if (!parsed.success) return { error: 'Select an account to invite.' }
    const invitation = await createInvite(parsed.data.userId)
    return { invitePath: invitation.path }
  } catch (error) {
    if (error instanceof AccessError || error instanceof InviteError) return { error: error.message }
    return { error: 'Could not create the invitation. Please try again.' }
  }
}
