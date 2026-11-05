'use client'
import { useActionState } from 'react'
import { loginAction } from '@/app/login/actions'
import { SubmitButton } from './submit-button'
import { PasswordInput } from './ui/password-input'

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {})
  return <form action={action} className="space-y-5">
    <div><label htmlFor="email" className="label">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="username" maxLength={254} required /></div>
    <div><label htmlFor="password" className="label">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
  </form>
}
