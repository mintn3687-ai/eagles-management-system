'use server'
import { headers } from 'next/headers'
import { acceptInvite } from '@/lib/auth/invites'
import { acceptInviteSchema } from '@/lib/validation/auth'
import type { FormState } from '@/lib/form-state'
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit'

export async function acceptInviteAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = acceptInviteSchema.safeParse({
    token: form.get('token'), password: form.get('password'), confirmPassword: form.get('confirmPassword'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const requestHeaders = await headers()
    const ipLimit = await consumeRateLimit('invite-accept-ip', requestIdentity({ headers: requestHeaders }), 20, 60 * 60_000)
    const tokenLimit = await consumeRateLimit('invite-accept-token', parsed.data.token, 5, 60 * 60_000)
    if (!ipLimit.allowed || !tokenLimit.allowed) return { error: 'Too many attempts. Please try again later.' }
    // Possession of an unexpired, unused invitation authorizes this public action.
    if (!await acceptInvite(parsed.data)) return { error: 'This invitation is invalid, expired, or already used. Ask the committee for a new one.' }
    return { success: true }
  } catch {
    return { error: 'Could not set your password. Please try again.' }
  }
}
