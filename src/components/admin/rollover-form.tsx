'use client'
import { useActionState } from 'react'
import { createSeasonAction } from '@/modules/seasons/actions'
import { SubmitButton } from '@/components/submit-button'
import { FormField } from '@/components/ui/form-field'

export function RolloverForm({
  members,
  defaultName,
  defaultStartDate,
  defaultEndDate,
}: {
  members: { id: string; fullName: string; status: string; isSuperAdmin: boolean }[]
  defaultName: string
  defaultStartDate: string
  defaultEndDate: string
}) {
  const [state, action] = useActionState(createSeasonAction, {})
  return <form action={action} className="space-y-5">
    <div className="grid gap-4 md:grid-cols-3">
      <FormField label="New season name" htmlFor="seasonName">
        <input className="input" id="seasonName" name="name" defaultValue={defaultName} required maxLength={80} />
      </FormField>
      <FormField label="Start date" htmlFor="seasonStartDate">
        <input className="input" id="seasonStartDate" name="startDate" type="date" defaultValue={defaultStartDate} required />
      </FormField>
      <FormField label="End date" htmlFor="seasonEndDate">
        <input className="input" id="seasonEndDate" name="endDate" type="date" defaultValue={defaultEndDate} required />
      </FormField>
    </div>
    <fieldset className="space-y-2">
      <legend className="label">Optional: change status for selected active members in the new season</legend>
      <p className="text-sm text-slate-600">All unselected memberships are carried forward unchanged. Select no members to carry everyone forward as-is.</p>
      {members.map((member) => <label key={member.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 p-3">
        <input className="h-5 w-5 accent-emerald-800" type="checkbox" name="memberIds" value={member.id} disabled={member.isSuperAdmin} />
        <span className="flex-1">{member.fullName} <span className="text-sm text-slate-500">({member.status.replaceAll('_', ' ')})</span></span>
        {member.isSuperAdmin && <span className="text-xs text-slate-500">Transfer admin access first</span>}
      </label>)}
      {!members.length && <p className="text-slate-600">There are no active members on this page.</p>}
    </fieldset>
    <FormField label="Status to apply to selected members" htmlFor="rolloverStatus">
      <select className="input" id="rolloverStatus" name="status" defaultValue="INACTIVE"><option value="INACTIVE">Inactive</option><option value="ALUMNI">Alumni</option></select>
    </FormField>
    <FormField label="Type ROLLOVER to confirm" htmlFor="rolloverConfirmation">
      <input className="input" id="rolloverConfirmation" name="confirmation" maxLength={8} autoComplete="off" required />
    </FormField>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p className="text-emerald-800" role="status">{state.message ?? 'Season rollover complete.'}</p>}
    <SubmitButton>Create next season</SubmitButton>
  </form>
}
