'use client'
import { useActionState } from 'react'
import { rolloverMembersAction } from '@/app/admin/rollover/actions'
import { SubmitButton } from '@/components/submit-button'

export function RolloverForm({ members }: { members: { id: string; fullName: string; status: string; isSuperAdmin: boolean }[] }) {
  const [state, action] = useActionState(rolloverMembersAction, {})
  return <form action={action} className="card space-y-5">
    <fieldset className="space-y-2">
      <legend className="label">Select active members on this page</legend>
      {members.map((member) => <label key={member.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 p-3">
        <input className="h-5 w-5 accent-emerald-800" type="checkbox" name="memberIds" value={member.id} disabled={member.isSuperAdmin} />
        <span className="flex-1">{member.fullName} <span className="text-sm text-slate-500">({member.status.replaceAll('_', ' ')})</span></span>
        {member.isSuperAdmin && <span className="text-xs text-slate-500">Transfer admin access first</span>}
      </label>)}
      {!members.length && <p className="text-slate-600">There are no active members on this page.</p>}
    </fieldset>
    <div><label className="label" htmlFor="rolloverStatus">New membership status</label><select className="input" id="rolloverStatus" name="status" defaultValue="INACTIVE"><option value="INACTIVE">Inactive</option><option value="ALUMNI">Alumni</option></select></div>
    <div><label className="label" htmlFor="rolloverConfirmation">Type ROLLOVER to confirm</label><input className="input" id="rolloverConfirmation" name="confirmation" maxLength={8} autoComplete="off" required /></div>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p className="text-emerald-800" role="status">{state.message ?? 'Season rollover complete.'}</p>}
    <SubmitButton>Update selected members</SubmitButton>
  </form>
}
