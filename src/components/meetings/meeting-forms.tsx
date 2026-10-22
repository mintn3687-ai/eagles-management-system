'use client'

import { useActionState } from 'react'
import {
  addAgendaItemAction,
  addMeetingActionItemAction,
  addMotionAction,
  approveMeetingMinutesAction,
  createMeetingAction,
  decideMotionAction,
  saveMeetingMinutesAction,
  transitionMeetingAction,
  updateMeetingAttendanceAction,
  updateMeetingActionItemStatusAction,
} from '@/modules/meetings/actions'
import type { MeetingActionState } from '@/modules/meetings/actions'
import { SubmitButton } from '@/components/submit-button'

function FormNotice({ state }: { state: MeetingActionState }) {
  return state.error
    ? <p className="error" role="alert">{state.error}</p>
    : state.success
      ? <p className="text-sm text-emerald-800" role="status">{state.message}</p>
      : null
}

export function MeetingCreateForm({ today }: { today: string }) {
  const [state, action] = useActionState(createMeetingAction, {})
  return <form action={action} className="card space-y-4">
    <h2>Schedule a meeting</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="meetingTitle">Title</label><input className="input" id="meetingTitle" name="title" maxLength={120} required /></div>
      <div><label className="label" htmlFor="meetingVenue">Venue</label><input className="input" id="meetingVenue" name="venue" maxLength={160} required /></div>
      <div><label className="label" htmlFor="meetingDate">Date</label><input className="input" id="meetingDate" name="meetingDate" type="date" defaultValue={today} required /></div>
      <div><label className="label" htmlFor="meetingTime">Start time (Nairobi)</label><input className="input" id="meetingTime" name="startTime" type="time" required /></div>
      <div><label className="label" htmlFor="meetingQuorum">Quorum threshold (%)</label><input className="input" id="meetingQuorum" name="quorumPercent" type="number" min={1} max={100} defaultValue={50} required /></div>
    </div>
    <p className="text-sm text-slate-600">Eligible attendees are frozen from active members in the current season when the meeting is created.</p>
    <FormNotice state={state} />
    <SubmitButton>Create meeting draft</SubmitButton>
  </form>
}

export function MeetingStatusForm({ meetingId, status }: { meetingId: string; status: string }) {
  const [state, action] = useActionState(transitionMeetingAction, {})
  if (status === 'COMPLETED' || status === 'CANCELLED') return null
  return <form action={action} className="flex flex-wrap items-end gap-3">
    <input type="hidden" name="meetingId" value={meetingId} />
    <div><label className="label" htmlFor="meetingNextStatus">Meeting status</label>
      <select className="input" id="meetingNextStatus" name="status" defaultValue={status === 'DRAFT' ? 'SCHEDULED' : 'COMPLETED'}>
        {status === 'DRAFT' && <option value="SCHEDULED">Scheduled</option>}
        {status === 'DRAFT' && <option value="CANCELLED">Cancelled</option>}
        {status === 'SCHEDULED' && <option value="COMPLETED">Completed</option>}
        {status === 'SCHEDULED' && <option value="CANCELLED">Cancelled</option>}
      </select>
    </div>
    <SubmitButton>Update status</SubmitButton>
    <FormNotice state={state} />
  </form>
}

export function AgendaItemForm({ meetingId }: { meetingId: string }) {
  const [state, action] = useActionState(addAgendaItemAction, {})
  return <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-4">
    <input type="hidden" name="meetingId" value={meetingId} />
    <h3>Add agenda item</h3>
    <label className="sr-only" htmlFor="agendaTitle">Agenda item title</label>
    <input className="input" id="agendaTitle" name="title" placeholder="Agenda item title" maxLength={160} required />
    <label className="sr-only" htmlFor="agendaDescription">Agenda item detail</label>
    <textarea className="input" id="agendaDescription" name="description" placeholder="Optional detail" maxLength={2000} rows={2} />
    <FormNotice state={state} />
    <SubmitButton>Add to agenda</SubmitButton>
  </form>
}

export function AttendanceForm({ meetingId, attendance }: {
  meetingId: string
  attendance: Array<{ memberId: string; attended: boolean; member: { fullName: string } }>
}) {
  const [state, action] = useActionState(updateMeetingAttendanceAction, {})
  return <form action={action} className="space-y-4">
    <input type="hidden" name="meetingId" value={meetingId} />
    <fieldset className="space-y-2">
      <legend className="label">Mark attendees present</legend>
      {attendance.map((record) => <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-100 p-3" key={record.memberId}>
        <input className="h-5 w-5 accent-emerald-800" type="checkbox" name="presentMemberIds" value={record.memberId} defaultChecked={record.attended} />
        <span>{record.member.fullName}</span>
      </label>)}
      {!attendance.length && <p className="text-sm text-slate-600">The meeting has no eligible attendees.</p>}
    </fieldset>
    <FormNotice state={state} />
    <SubmitButton>Save attendance</SubmitButton>
  </form>
}

export function MinutesForms({ meetingId, minutes, approved }: {
  meetingId: string
  minutes: string | null
  approved: boolean
}) {
  const [saveState, saveAction] = useActionState(saveMeetingMinutesAction, {})
  const [approveState, approveAction] = useActionState(approveMeetingMinutesAction, {})
  return <div className="space-y-4">
    <form action={saveAction} className="space-y-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <label className="label" htmlFor="meetingMinutes">{approved ? 'Approved minutes' : 'Minutes draft'}</label>
      <textarea className="input min-h-48" id="meetingMinutes" name="minutes" defaultValue={minutes ?? ''} maxLength={15000} readOnly={approved} required />
      {!approved && <><FormNotice state={saveState} /><SubmitButton>Save draft minutes</SubmitButton></>}
    </form>
    {!approved && <form action={approveAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <SubmitButton>Approve and publish minutes</SubmitButton>
      <FormNotice state={approveState} />
    </form>}
  </div>
}

export function MotionForm({ meetingId }: { meetingId: string }) {
  const [state, action] = useActionState(addMotionAction, {})
  return <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-4">
    <input type="hidden" name="meetingId" value={meetingId} />
    <h3>Record a motion</h3>
    <label className="sr-only" htmlFor="motionTitle">Motion title</label>
    <input className="input" id="motionTitle" name="title" placeholder="Motion title" maxLength={160} required />
    <label className="sr-only" htmlFor="motionDescription">Motion detail</label>
    <textarea className="input" id="motionDescription" name="description" placeholder="Optional detail" maxLength={2000} rows={2} />
    <FormNotice state={state} />
    <SubmitButton>Add motion</SubmitButton>
  </form>
}

export function MotionDecisionForm({ meetingId, motionId }: { meetingId: string; motionId: string }) {
  const [state, action] = useActionState(decideMotionAction, {})
  return <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
    <input type="hidden" name="meetingId" value={meetingId} />
    <input type="hidden" name="motionId" value={motionId} />
    <div><label className="label" htmlFor={`motionDecision-${motionId}`}>Decision</label>
      <select className="input" id={`motionDecision-${motionId}`} name="status">
        <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="DEFERRED">Deferred</option>
      </select>
    </div>
    <div className="min-w-52 flex-1"><label className="label" htmlFor={`motionNote-${motionId}`}>Decision note</label><input className="input" id={`motionNote-${motionId}`} name="decisionNote" maxLength={1000} /></div>
    <SubmitButton>Record decision</SubmitButton>
    <FormNotice state={state} />
  </form>
}

export function ActionItemForm({ meetingId, members }: {
  meetingId: string
  members: Array<{ memberId: string; member: { fullName: string } }>
}) {
  const [state, action] = useActionState(addMeetingActionItemAction, {})
  return <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-4">
    <input type="hidden" name="meetingId" value={meetingId} />
    <h3>Assign an action item</h3>
    <label className="sr-only" htmlFor="actionTitle">Action item title</label>
    <input className="input" id="actionTitle" name="title" placeholder="Action item title" maxLength={160} required />
    <label className="sr-only" htmlFor="actionDescription">Action item details</label>
    <textarea className="input" id="actionDescription" name="description" placeholder="Optional details" maxLength={2000} rows={2} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="actionOwner">Owner</label>
        <select className="input" id="actionOwner" name="ownerMemberId" required defaultValue="">
          <option value="" disabled>Choose an eligible member</option>
          {members.map((item) => <option key={item.memberId} value={item.memberId}>{item.member.fullName}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="actionDueDate">Due date (optional)</label><input className="input" id="actionDueDate" name="dueDate" type="date" /></div>
    </div>
    <FormNotice state={state} />
    <SubmitButton>Assign action item</SubmitButton>
  </form>
}

export function ActionItemStatusForm({ meetingId, actionItemId, status }: {
  meetingId: string
  actionItemId: string
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}) {
  const [state, action] = useActionState(updateMeetingActionItemStatusAction, {})
  if (status === 'COMPLETED' || status === 'CANCELLED') return null
  return <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
    <input type="hidden" name="meetingId" value={meetingId} />
    <input type="hidden" name="actionItemId" value={actionItemId} />
    <div><label className="label" htmlFor={`actionStatus-${actionItemId}`}>Update status</label>
      <select className="input" id={`actionStatus-${actionItemId}`} name="status" defaultValue={status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED'}>
        {status === 'OPEN' && <option value="IN_PROGRESS">In progress</option>}
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
    </div>
    <SubmitButton>Save status</SubmitButton>
    <FormNotice state={state} />
  </form>
}
