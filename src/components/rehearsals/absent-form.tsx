'use client'
import { useActionState } from 'react'
import { markAbsentAction } from '@/app/member/attendance/actions'

export function AbsentForm({ rehearsalId, past = false }: { rehearsalId: string; past?: boolean }) {
  const [state, action] = useActionState(markAbsentAction, {})
  return <form action={action} className="space-y-4 border-t border-slate-200 pt-4">
    <input type="hidden" name="rehearsalId" value={rehearsalId} />
    <h3 className="font-medium">Cannot attend?</h3>
    <div>
      <label className="label" htmlFor={`reason-${rehearsalId}`}>Reason</label>
      <textarea className="input min-h-24" id={`reason-${rehearsalId}`} name="reason" maxLength={1000} placeholder="Enter at least 10 characters..." required minLength={10} />
    </div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p role="status" className="text-emerald-800">Absence submitted for review.</p>}
    <button type="submit" className="btn-secondary">{past ? 'I was absent' : 'I will be absent'}</button>
  </form>
}
