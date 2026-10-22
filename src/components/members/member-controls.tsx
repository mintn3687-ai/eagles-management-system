'use client'
import { useActionState, useState } from 'react'
import { memberInviteAction, roleAction, statusAction } from '@/app/admin/members/actions'
import { memberStatuses } from '@/lib/validation/members'
import { SubmitButton } from '../submit-button'
import { InviteShare } from './invite-share'

export function StatusForm({ memberId, status }: { memberId: string; status: string }) {
  const [state, action] = useActionState(statusAction, {})
  const [selected, setSelected] = useState(status)
  return <form action={action} className="space-y-4"><input type="hidden" name="memberId" value={memberId} />
    <div><label className="label" htmlFor="status">Membership status</label><select className="input" id="status" name="status" value={selected} onChange={(e) => setSelected(e.target.value)}>{memberStatuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></div>
    <div><label className="label" htmlFor="reason">Reason {['INACTIVE', 'SUSPENDED'].includes(selected) ? '(required)' : '(optional)'}</label><textarea className="input" id="reason" name="reason" maxLength={1000} required={['INACTIVE', 'SUSPENDED'].includes(selected)} /></div>
    <p className="text-sm text-slate-500">To deactivate a member, choose INACTIVE. Their record stays in the register.</p>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p role="status">Status updated.</p>}<SubmitButton>Update status</SubmitButton>
  </form>
}
export function RoleForm({ memberId, role }: { memberId: string; role: string }) {
  if (role === 'SUPER_ADMIN') return <p className="text-sm text-slate-600">Super Admin access can only be changed using the confirmed team transfer.</p>
  const [state, action] = useActionState(roleAction, {})
  return <form action={action} className="space-y-4"><input type="hidden" name="memberId" value={memberId} /><label className="label" htmlFor="role">Login role</label><select className="input" id="role" name="role" defaultValue={role}>{['MEMBER', 'COMMITTEE'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>{state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p role="status">Role updated.</p>}<SubmitButton>Change role</SubmitButton></form>
}
export function RegenerateInviteForm({ memberId }: { memberId: string }) {
  const [state, action] = useActionState(memberInviteAction, {})
  return <form action={action} className="space-y-4"><input type="hidden" name="memberId" value={memberId} /><p className="text-sm text-slate-600">The new link replaces earlier invitations and can reset an existing password. Completing the reset signs out older sessions.</p><SubmitButton>Generate invitation / password reset</SubmitButton>{state.error && <p className="error" role="alert">{state.error}</p>}{state.invitePath && <InviteShare path={state.invitePath} name={state.name!} phone={state.phone!} />}</form>
}
