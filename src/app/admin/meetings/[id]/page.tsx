import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { formatNairobiDate } from '@/lib/dates'
import { getMeetingDetail } from '@/modules/meetings/read-service'
import {
  ActionItemForm,
  ActionItemStatusForm,
  AgendaItemForm,
  AttendanceForm,
  MeetingStatusForm,
  MinutesForms,
  MotionDecisionForm,
  MotionForm,
} from '@/components/meetings/meeting-forms'

const motionLabels = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', DEFERRED: 'Deferred' }
const actionLabels = { OPEN: 'Open', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await pagePermission('meetings:manage')
  const parsedId = userIdSchema.safeParse((await params).id)
  if (!parsedId.success) notFound()
  const meeting = await getMeetingDetail(parsedId.data)
  if (!meeting) notFound()

  const locked = meeting.minutesStatus === 'APPROVED' || meeting.status === 'CANCELLED'
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/admin/meetings">Back to meetings</Link>
    <header className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-1 text-sm font-semibold uppercase tracking-widest text-emerald-700">Meeting record</p><h1>{meeting.title}</h1></div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{meeting.status.replaceAll('_', ' ')}</span>
      </div>
      <p className="text-slate-600">{formatNairobiDate(meeting.startsAt, true)} · {meeting.venue}</p>
      <p className="text-sm text-slate-700">Quorum: {meeting.quorum.attendedCount} of {meeting.quorum.eligibleCount} present; {meeting.quorum.requiredCount} required ({meeting.quorumPercent}%). {meeting.quorum.hasQuorum ? 'Quorum reached.' : 'Quorum not reached.'}</p>
      <MeetingStatusForm meetingId={meeting.id} status={meeting.status} />
    </header>

    <section className="card space-y-4">
      <h2>Agenda</h2>
      {meeting.agendaItems.length
        ? <ol className="list-decimal space-y-2 pl-6">{meeting.agendaItems.map((item) => <li key={item.id}><p className="font-medium">{item.title}</p>{item.description && <p className="text-sm text-slate-600">{item.description}</p>}</li>)}</ol>
        : <p className="text-sm text-slate-600">No agenda items have been added.</p>}
      {!locked && <AgendaItemForm meetingId={meeting.id} />}
    </section>

    <section className="card space-y-4">
      <h2>Attendance and quorum</h2>
      <p className="text-sm text-slate-600">The eligible-member list was frozen when this meeting was created. Members added later are not included.</p>
      {locked
        ? <ul className="grid gap-2 sm:grid-cols-2">{meeting.attendances.map((record) => <li className="rounded-lg bg-stone-50 p-3" key={record.memberId}>{record.member.fullName}: {record.attended ? 'Present' : 'Not marked present'}</li>)}</ul>
        : meeting.status !== 'DRAFT'
          ? <AttendanceForm meetingId={meeting.id} attendance={meeting.attendances} />
          : <p className="text-sm text-slate-600">Schedule the meeting before marking attendance.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Motions and decisions</h2>
      {meeting.motions.length
        ? <ul className="space-y-3">{meeting.motions.map((motion) => <li className="rounded-lg border border-slate-200 p-4" key={motion.id}>
          <p className="font-semibold">{motion.title} <span className="ml-2 text-sm font-normal text-slate-500">{motionLabels[motion.status]}</span></p>
          {motion.description && <p className="mt-1 text-sm text-slate-600">{motion.description}</p>}
          {motion.decisionNote && <p className="mt-2 text-sm">Decision note: {motion.decisionNote}</p>}
          {!locked && motion.status === 'PENDING' && meeting.status !== 'DRAFT' && <MotionDecisionForm meetingId={meeting.id} motionId={motion.id} />}
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No motions have been recorded.</p>}
      {!locked && meeting.status !== 'DRAFT' && <MotionForm meetingId={meeting.id} />}
    </section>

    <section className="card space-y-4">
      <h2>Minutes</h2>
      <p className="text-sm text-slate-600">Minutes move from draft to approved. Approval requires a completed meeting and quorum; approved minutes are visible to members and locked.</p>
      {meeting.status === 'COMPLETED'
        ? <MinutesForms meetingId={meeting.id} minutes={meeting.minutes} approved={meeting.minutesStatus === 'APPROVED'} />
        : <p className="text-sm text-slate-600">{meeting.minutesStatus === 'APPROVED' ? 'Approved' : 'Draft'} — complete the meeting before editing or approving minutes.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Action items</h2>
      {meeting.actionItems.length
        ? <ul className="space-y-2">{meeting.actionItems.map((item) => <li className="rounded-lg bg-stone-50 p-3" key={item.id}>
          <p className="font-medium">{item.title} <span className="ml-2 text-sm font-normal text-slate-500">{actionLabels[item.status]}</span></p>
          <p className="text-sm text-slate-600">Owner: {item.owner.fullName}{item.dueAt ? ` · Due ${formatNairobiDate(item.dueAt)}` : ''}</p>
          {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
          <ActionItemStatusForm meetingId={meeting.id} actionItemId={item.id} status={item.status} />
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No action items have been assigned.</p>}
      {!locked && <ActionItemForm meetingId={meeting.id} members={meeting.attendances} />}
    </section>
  </div>
}
