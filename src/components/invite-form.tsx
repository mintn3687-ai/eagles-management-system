'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { acceptInviteAction } from '@/app/invite/[token]/actions'
import { SubmitButton } from './submit-button'
import { PasswordInput } from './ui/password-input'

export function InviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, {})
  if (state.success) return <div className="space-y-4" role="status"><p>Your password is set. You can now sign in.</p><Link href="/login" className="btn-primary">Go to sign in</Link></div>
  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <p className="text-sm text-slate-600" id="password-help">Use at least 12 characters. A memorable passphrase works well.</p>
    <div><label className="label" htmlFor="password">New password</label><PasswordInput name="password" id="password" autoComplete="new-password" aria-describedby="password-help" minLength={12} required /></div>
    <div><label className="label" htmlFor="confirmPassword">Confirm password</label><PasswordInput name="confirmPassword" id="confirmPassword" autoComplete="new-password" required /></div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    <SubmitButton pendingText="Setting password…">Set password</SubmitButton>
  </form>
}
