'use client'
import { useActionState } from 'react'
import { markPresentAction } from '@/app/member/attendance/actions'
import { SubmitButton } from '@/components/submit-button'

export function CheckInForm({ rehearsalId }: { rehearsalId: string }) {
  const [state, action] = useActionState(markPresentAction, {})
  return <form action={action} className="space-y-4">
    <input type="hidden" name="rehearsalId" value={rehearsalId} />
    <div>
      <label className="label" htmlFor="code">Check-in code</label>
      <input className="input text-center font-mono text-3xl tracking-widest" id="code" name="code" maxLength={4} pattern="\d{4}" required autoComplete="one-time-code" />
    </div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p role="status" className="text-emerald-800">You are marked present.</p>}
    <SubmitButton>Mark present</SubmitButton>
  </form>
}
