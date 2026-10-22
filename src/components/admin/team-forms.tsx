'use client'
import { useActionState } from 'react'
import { changeTeamRoleAction, transferSuperAdminAction } from '@/app/admin/team/actions'
import { SubmitButton } from '@/components/submit-button'

export function TeamRoleForm({ memberId, role }: { memberId: string; role: 'MEMBER' | 'COMMITTEE' }) {
  const [state, action] = useActionState(changeTeamRoleAction, {})
  return <form action={action} className="flex min-w-64 flex-wrap items-end gap-2">
    <input type="hidden" name="memberId" value={memberId} />
    <div className="min-w-36 flex-1"><label className="label" htmlFor={`role-${memberId}`}>Login role</label><select className="input" id={`role-${memberId}`} name="role" defaultValue={role}><option value="MEMBER">Member</option><option value="COMMITTEE">Committee</option></select></div>
    <SubmitButton>Save role</SubmitButton>
    {state.error && <p className="error w-full" role="alert">{state.error}</p>}{state.success && <p className="w-full text-sm text-emerald-800" role="status">Role updated.</p>}
  </form>
}

export function TransferAdminForm({ members }: { members: { id: string; fullName: string }[] }) {
  const [state, action] = useActionState(transferSuperAdminAction, {})
  return <form action={action} className="space-y-4">
    <div><label className="label" htmlFor="transferMemberId">New Super Admin</label><select className="input" id="transferMemberId" name="memberId" required defaultValue=""><option value="" disabled>Select a member with a login</option>{members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}</select></div>
    <div><label className="label" htmlFor="transferConfirmation">Type TRANSFER to confirm</label><input className="input" id="transferConfirmation" name="confirmation" maxLength={8} autoComplete="off" required /></div>
    <p className="text-sm text-slate-600">The selected member becomes Super Admin and your account becomes Committee.</p>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p className="text-emerald-800" role="status">Super Admin access transferred.</p>}
    <SubmitButton>Transfer Super Admin</SubmitButton>
  </form>
}
