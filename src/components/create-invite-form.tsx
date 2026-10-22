'use client'
import { useActionState } from 'react'
import { createInviteAction } from '@/app/admin/actions'
import { SubmitButton } from './submit-button'

export function CreateInviteForm({ users }: { users: { id: string; name: string; email: string }[] }) {
  const [state, action] = useActionState(createInviteAction, {})
  return <form action={action} className="space-y-4">
    <div><label className="label" htmlFor="userId">Account awaiting a password</label><select className="input" id="userId" name="userId" required defaultValue=""><option value="" disabled>Select an account</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}</select></div>
    <SubmitButton pendingText="Creating invitation…">Create invitation</SubmitButton>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.invitePath && <div className="space-y-2 rounded-lg bg-emerald-50 p-4" role="status"><p>Invitation ready. Share this link privately with the member. It expires in 7 days. Creating another invitation replaces the previous one.</p><a className="block break-all underline" href={state.invitePath}>Open invitation</a><button className="btn-secondary" type="button" onClick={async (event) => {
      const button = event.currentTarget
      try { await navigator.clipboard.writeText(new URL(state.invitePath!, window.location.origin).href); button.textContent = 'Copied' }
      catch { button.textContent = 'Open the invitation and copy its address' }
    }}>Copy invitation link</button></div>}
  </form>
}
