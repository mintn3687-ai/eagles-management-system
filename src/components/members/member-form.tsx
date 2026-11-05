'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createMemberAction, editMemberAction } from '@/app/admin/members/actions'
import { SubmitButton } from '../submit-button'
import { InviteShare } from './invite-share'

type Details = { id: string; fullName: string; phone: string; email: string; studentRegNo: string | null; emergencyContactName: string; emergencyContactPhone: string; notes: string | null }
type MemberFields = Omit<Details, 'id' | 'studentRegNo' | 'notes'> & { studentRegNo: string; notes: string }

export function MemberForm({ member }: { member?: Details }) {
  const [state, action] = useActionState(member ? editMemberAction : createMemberAction, {})
  const [values, setValues] = useState<MemberFields>(() => ({
    fullName: member?.fullName ?? '',
    phone: member?.phone ?? '',
    email: member?.email ?? '',
    studentRegNo: member?.studentRegNo ?? '',
    emergencyContactName: member?.emergencyContactName ?? '',
    emergencyContactPhone: member?.emergencyContactPhone ?? '',
    notes: member?.notes ?? '',
  }))
  const [existingMember, setExistingMember] = useState(false)
  if (!member && state.success && state.invitePath) return <div className="space-y-5"><p role="status">Member created successfully.</p><InviteShare path={state.invitePath} name={state.name!} phone={state.phone!} /><Link className="btn-primary" href={`/admin/members/${state.memberId}`}>Open member record</Link></div>
  return <form action={action} className="space-y-5">
    {member && <input type="hidden" name="memberId" value={member.id} />}
    <div className="grid gap-5 sm:grid-cols-2">
      {([
        ['fullName', 'Full name', 'text', true, 100], ['phone', 'Phone (01…, 07… or 254…)', 'tel', true, 32],
        ['email', 'Email address', 'email', true, 254], ['studentRegNo', 'Student registration number (optional)', 'text', false, 50],
        ['emergencyContactName', 'Emergency contact name', 'text', true, 100], ['emergencyContactPhone', 'Emergency contact phone', 'tel', true, 32],
      ] as const).map(([key, label, type, required, maxLength]) => <div key={key}><label className="label" htmlFor={key}>{label}</label><input id={key} name={key} className="input" type={type} required={required} maxLength={maxLength} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
    </div>
    <div><label className="label" htmlFor="notes">Notes (optional)</label><textarea id="notes" name="notes" className="input min-h-24" maxLength={2000} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></div>
    {!member && <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 p-4"><input className="h-5 w-5 accent-emerald-800" type="checkbox" name="existingMember" checked={existingMember} onChange={(event) => setExistingMember(event.target.checked)} /><span>Existing member (already registered)</span></label>}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {member && state.success && <p role="status" className="text-emerald-800">Details saved.</p>}
    <SubmitButton>{member ? 'Save member details' : 'Create member and invitation'}</SubmitButton>
  </form>
}
