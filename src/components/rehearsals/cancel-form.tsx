'use client'
import { useActionState } from 'react'
import { cancelRehearsalAction } from '@/app/admin/rehearsals/actions'

export function CancelRehearsalForm({ rehearsalId }: { rehearsalId: string }) {
  const [state, action] = useActionState(cancelRehearsalAction, {})
  return <section className="card">
    <h2>Cancel rehearsal</h2>
    <form action={action} className="space-y-4">
      <input type="hidden" name="rehearsalId" value={rehearsalId} />
      <div><label className="label" htmlFor="reason">Reason for cancellation</label><textarea className="input min-h-24" id="reason" name="reason" maxLength={500} required /></div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.success && <p role="status">Rehearsal cancelled.</p>}
      <button type="submit" className="btn-secondary">Cancel this rehearsal</button>
    </form>
  </section>
}
