'use client'

import { useActionState, type ReactNode } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { formatNairobiDate } from '@/lib/dates'
import {
  addPostShowNoteAction,
  addProductionRoleAction,
  addScriptVersionAction,
  assignCastingAction,
  assignCrewAction,
  checkinAssetAction,
  checkoutAssetAction,
  createAssetAction,
  createCallSheetAction,
  createProductionAction,
  createProductionTaskAction,
  linkRehearsalAction,
  productionStatusAction,
  productionTaskStatusAction,
  scheduleShowAction,
} from '@/modules/productions/actions'
import type { ProductionActionState } from '@/modules/productions/actions'

type Action = (state: ProductionActionState, form: FormData) => Promise<ProductionActionState>
type MemberOption = { memberId: string; member: { fullName: string } }
type RoleOption = { id: string; name: string }
type ShowOption = { id: string; startsAt: Date; venue: string }
type AssetOption = { id: string; name: string; status: string; currentHolder: { fullName: string } | null }

function Form({ action: serverAction, submit, children, className = 'card space-y-4' }: {
  action: Action
  submit: string
  children: ReactNode
  className?: string
}) {
  const [state, action] = useActionState(serverAction, {})
  return <form action={action} className={className}>
    {children}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-800" role="status">{state.message}</p>}
    <SubmitButton>{submit}</SubmitButton>
  </form>
}

function HiddenProduction({ id }: { id: string }) {
  return <input type="hidden" name="productionId" value={id} />
}

function MemberSelect({ members, name = 'memberId', label = 'Member' }: {
  members: MemberOption[]
  name?: string
  label?: string
}) {
  const id = `${name}-${label.replaceAll(' ', '-')}`
  return <div><label className="label" htmlFor={id}>{label}</label>
    <select className="input" id={id} name={name} required defaultValue="">
      <option value="" disabled>Select a member</option>
      {members.map(({ memberId, member }) => <option key={memberId} value={memberId}>{member.fullName}</option>)}
    </select>
  </div>
}

export function ProductionCreateForm({ today }: { today: string }) {
  return <Form action={createProductionAction} submit="Create production">
    <h2>Start a production</h2>
    <div><label className="label" htmlFor="production-title">Title</label><input className="input" id="production-title" name="title" maxLength={120} required /></div>
    <div><label className="label" htmlFor="production-description">Description</label><textarea className="input" id="production-description" name="description" maxLength={2000} rows={3} /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="production-start">Start date</label><input className="input" id="production-start" name="startDate" type="date" defaultValue={today} /></div>
      <div><label className="label" htmlFor="production-end">End date</label><input className="input" id="production-end" name="endDate" type="date" /></div>
    </div>
  </Form>
}

export function ProductionStatusForm({ productionId, status }: { productionId: string; status: string }) {
  if (status === 'COMPLETED' || status === 'CANCELLED') return null
  return <Form action={productionStatusAction} submit="Update production status" className="flex flex-wrap items-end gap-3">
    <HiddenProduction id={productionId} />
    <div><label className="label" htmlFor="production-status">Status</label>
      <select className="input" id="production-status" name="status" defaultValue={status === 'PLANNING' ? 'ACTIVE' : 'COMPLETED'}>
        {status === 'PLANNING' && <option value="ACTIVE">Active</option>}
        {status !== 'PLANNING' && <option value="COMPLETED">Completed</option>}
        <option value="CANCELLED">Cancelled</option>
      </select>
    </div>
  </Form>
}

export function ScriptVersionForm({ productionId }: { productionId: string }) {
  return <Form action={addScriptVersionAction} submit="Record script version">
    <HiddenProduction id={productionId} />
    <h3>Script version</h3>
    <div><label className="label" htmlFor="script-version">Version label</label><input className="input" id="script-version" name="version" maxLength={80} required /></div>
    <div><label className="label" htmlFor="script-rights">Usage-rights notes</label><textarea className="input" id="script-rights" name="usageRightsNotes" maxLength={2000} required rows={3} /></div>
    <div><label className="label" htmlFor="script-reference">Storage reference (optional)</label><input className="input" id="script-reference" name="storageReference" maxLength={500} /></div>
  </Form>
}

export function RoleForm({ productionId }: { productionId: string }) {
  return <Form action={addProductionRoleAction} submit="Add role">
    <HiddenProduction id={productionId} />
    <h3>Add role</h3>
    <div><label className="label" htmlFor="role-name">Role name</label><input className="input" id="role-name" name="name" maxLength={100} required /></div>
    <div><label className="label" htmlFor="role-description">Description</label><input className="input" id="role-description" name="description" maxLength={1000} /></div>
  </Form>
}

export function CastingForm({ productionId, roles, members }: {
  productionId: string; roles: RoleOption[]; members: MemberOption[]
}) {
  return <Form action={assignCastingAction} submit="Save casting">
    <HiddenProduction id={productionId} />
    <h3>Cast a member</h3>
    <div><label className="label" htmlFor="casting-role">Role</label><select className="input" id="casting-role" name="roleId" required defaultValue="">
      <option value="" disabled>Select a role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
    </select></div>
    <MemberSelect members={members} label="Casting member" />
    <div><label className="label" htmlFor="casting-type">Assignment type</label><select className="input" id="casting-type" name="type"><option value="CAST">Cast</option><option value="UNDERSTUDY">Understudy</option></select></div>
  </Form>
}

export function CrewForm({ productionId, members }: { productionId: string; members: MemberOption[] }) {
  return <Form action={assignCrewAction} submit="Assign crew">
    <HiddenProduction id={productionId} />
    <h3>Crew assignment</h3>
    <MemberSelect members={members} label="Crew member" />
    <div><label className="label" htmlFor="crew-assignment">Assignment</label><input className="input" id="crew-assignment" name="assignment" maxLength={100} required /></div>
  </Form>
}

export function TaskForm({ productionId, members }: { productionId: string; members: MemberOption[] }) {
  return <Form action={createProductionTaskAction} submit="Create task">
    <HiddenProduction id={productionId} />
    <h3>Production task</h3>
    <div><label className="label" htmlFor="task-title">Title</label><input className="input" id="task-title" name="title" maxLength={160} required /></div>
    <div><label className="label" htmlFor="task-description">Description</label><textarea className="input" id="task-description" name="description" maxLength={2000} rows={2} /></div>
    <div><label className="label" htmlFor="task-owner">Owner (optional)</label><select className="input" id="task-owner" name="ownerMemberId" defaultValue=""><option value="">Unassigned</option>{members.map(({ memberId, member }) => <option key={memberId} value={memberId}>{member.fullName}</option>)}</select></div>
    <div><label className="label" htmlFor="task-deadline">Deadline</label><input className="input" id="task-deadline" name="deadline" type="date" /></div>
  </Form>
}

export function TaskStatusForm({ productionId, taskId, status }: { productionId: string; taskId: string; status: string }) {
  if (status === 'COMPLETED' || status === 'CANCELLED') return null
  return <Form action={productionTaskStatusAction} submit="Save status" className="flex flex-wrap items-end gap-2">
    <HiddenProduction id={productionId} /><input type="hidden" name="taskId" value={taskId} />
    <label className="sr-only" htmlFor={`task-status-${taskId}`}>Task status</label>
    <select className="input" id={`task-status-${taskId}`} name="status" defaultValue={status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED'}>
      {status === 'OPEN' && <option value="IN_PROGRESS">In progress</option>}
      <option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
    </select>
  </Form>
}

export function ShowDateForm({ productionId, today }: { productionId: string; today: string }) {
  return <Form action={scheduleShowAction} submit="Schedule show">
    <HiddenProduction id={productionId} /><h3>Show date</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="show-date">Date</label><input className="input" id="show-date" name="date" type="date" defaultValue={today} required /></div>
      <div><label className="label" htmlFor="show-time">Start time (Nairobi)</label><input className="input" id="show-time" name="startTime" type="time" required /></div>
    </div>
    <div><label className="label" htmlFor="show-venue">Venue</label><input className="input" id="show-venue" name="venue" maxLength={160} required /></div>
  </Form>
}

export function CallSheetForm({ productionId, shows, members }: {
  productionId: string; shows: ShowOption[]; members: MemberOption[]
}) {
  return <Form action={createCallSheetAction} submit="Create call sheet">
    <HiddenProduction id={productionId} /><h3>Call sheet</h3>
    <div><label className="label" htmlFor="call-show">Show</label><select className="input" id="call-show" name="showDateId" required defaultValue="">
      <option value="" disabled>Select a show</option>{shows.map((show) => <option key={show.id} value={show.id}>{formatNairobiDate(show.startsAt)} · {show.venue}</option>)}
    </select></div>
    <div><label className="label" htmlFor="call-title">Title</label><input className="input" id="call-title" name="title" maxLength={120} required /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="call-date">Call date</label><input className="input" id="call-date" name="callDate" type="date" required /></div>
      <div><label className="label" htmlFor="call-time">Call time (Nairobi)</label><input className="input" id="call-time" name="callTime" type="time" required /></div>
    </div>
    <div><label className="label" htmlFor="call-notes">Notes</label><textarea className="input" id="call-notes" name="notes" maxLength={2000} rows={2} /></div>
    <fieldset className="space-y-1"><legend className="label">Members called</legend>
      {members.map(({ memberId, member }) => <label className="flex min-h-10 items-center gap-2" key={memberId}><input type="checkbox" name="memberIds" value={memberId} />{member.fullName}</label>)}
      {!members.length && <p className="text-sm text-slate-600">No active members are available.</p>}
    </fieldset>
  </Form>
}

export function AssetForm({ productionId }: { productionId?: string }) {
  return <Form action={createAssetAction} submit="Add asset">
    {productionId && <HiddenProduction id={productionId} />}<h3>Add asset</h3>
    <div><label className="label" htmlFor="asset-name">Name</label><input className="input" id="asset-name" name="name" maxLength={120} required /></div>
    <div><label className="label" htmlFor="asset-category">Category</label><select className="input" id="asset-category" name="category"><option value="PROP">Prop</option><option value="COSTUME">Costume</option><option value="EQUIPMENT">Equipment</option><option value="OTHER">Other</option></select></div>
    <div><label className="label" htmlFor="asset-condition">Condition</label><select className="input" id="asset-condition" name="condition"><option value="GOOD">Good</option><option value="EXCELLENT">Excellent</option><option value="FAIR">Fair</option><option value="NEEDS_REPAIR">Needs repair</option></select></div>
  </Form>
}

export function AssetMovementForms({ productionId, assets, members }: {
  productionId?: string; assets: AssetOption[]; members: MemberOption[]
}) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Form action={checkoutAssetAction} submit="Check out asset">
      {productionId && <input type="hidden" name="productionId" value={productionId} />}
      <div><label className="label" htmlFor="checkout-asset">Available asset</label><select className="input" id="checkout-asset" name="assetId" required defaultValue="">
        <option value="" disabled>Select an asset</option>{assets.filter((asset) => asset.status === 'AVAILABLE').map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
      </select></div>
      <MemberSelect members={members} label="Checkout member" />
    </Form>
    <Form action={checkinAssetAction} submit="Check in asset">
      {productionId && <input type="hidden" name="productionId" value={productionId} />}
      <div><label className="label" htmlFor="checkin-asset">Checked-out asset</label><select className="input" id="checkin-asset" name="assetId" required defaultValue="">
        <option value="" disabled>Select an asset</option>{assets.filter((asset) => asset.status === 'CHECKED_OUT').map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.currentHolder?.fullName ?? 'Holder unknown'}</option>)}
      </select></div>
    </Form>
  </div>
}

export function PostShowNoteForm({ productionId, shows }: { productionId: string; shows: ShowOption[] }) {
  return <Form action={addPostShowNoteAction} submit="Save post-show note">
    <HiddenProduction id={productionId} /><h3>Post-show note</h3>
    <div><label className="label" htmlFor="note-show">Show (optional)</label><select className="input" id="note-show" name="showDateId" defaultValue=""><option value="">General production note</option>{shows.map((show) => <option key={show.id} value={show.id}>{formatNairobiDate(show.startsAt)} · {show.venue}</option>)}</select></div>
    <div><label className="label" htmlFor="post-show-note">Note</label><textarea className="input" id="post-show-note" name="note" maxLength={5000} rows={4} required /></div>
  </Form>
}

export function RehearsalLinkForm({ productionId, rehearsals }: {
  productionId: string; rehearsals: Array<{ id: string; title: string; date: Date }>
}) {
  if (!rehearsals.length) return <p className="text-sm text-slate-600">No unlinked upcoming rehearsals are available.</p>
  return <Form action={linkRehearsalAction} submit="Link rehearsal">
    <HiddenProduction id={productionId} />
    <div><label className="label" htmlFor="link-rehearsal">Rehearsal</label><select className="input" id="link-rehearsal" name="rehearsalId" required defaultValue="">
      <option value="" disabled>Select a rehearsal</option>{rehearsals.map((rehearsal) => <option key={rehearsal.id} value={rehearsal.id}>{rehearsal.title} · {formatNairobiDate(rehearsal.date)}</option>)}
    </select></div>
  </Form>
}
