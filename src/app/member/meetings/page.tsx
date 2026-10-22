import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { formatNairobiDate } from '@/lib/dates'
import { getMemberGovernance } from '@/modules/meetings/read-service'

const actionLabels = { OPEN: 'Open', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }
const motionLabels = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', DEFERRED: 'Deferred' }

export default async function MemberMeetingsPage() {
  const user = await pagePermission('meetings:read')
  if (!user.member) redirect('/forbidden')
  const { minutes, actionItems } = await getMemberGovernance(user.member.id)
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/member">Back to home</Link>
    <header><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Club governance</p><h1>Meetings</h1><p className="text-slate-600">Approved minutes and action items assigned to you.</p></header>
    <section className="card space-y-4">
      <h2>Approved minutes</h2>
      {minutes.length
        ? <ul className="space-y-4">{minutes.map((meeting) => <li className="rounded-lg border border-slate-200 p-4" key={meeting.id}>
          <h3>{meeting.title}</h3>
          <p className="text-sm text-slate-600">{formatNairobiDate(meeting.startsAt, true)} · {meeting.venue}</p>
          {meeting.agendaItems.length > 0 && <div className="mt-3"><p className="font-medium">Agenda</p><ul className="list-disc pl-5 text-sm text-slate-700">{meeting.agendaItems.map((item, index) => <li key={`${meeting.id}-agenda-${index}`}>{item.title}</li>)}</ul></div>}
          <div className="mt-3 whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm">{meeting.minutes}</div>
          {meeting.motions.length > 0 && <div className="mt-3"><p className="font-medium">Decisions</p><ul className="list-disc pl-5 text-sm text-slate-700">{meeting.motions.map((motion, index) => <li key={`${meeting.id}-motion-${index}`}>{motion.title}: {motionLabels[motion.status]}{motion.decisionNote ? ` — ${motion.decisionNote}` : ''}</li>)}</ul></div>}
        </li>)}</ul>
        : <p className="text-slate-600">No minutes have been approved yet.</p>}
    </section>
    <section className="card space-y-4">
      <h2>My action items</h2>
      {actionItems.length
        ? <ul className="space-y-3">{actionItems.map((item) => <li className="rounded-lg border border-slate-200 p-4" key={item.id}>
          <p className="font-semibold">{item.title} <span className="ml-2 text-sm font-normal text-slate-500">{actionLabels[item.status]}</span></p>
          <p className="text-sm text-slate-600">{item.meeting.title} · {formatNairobiDate(item.meeting.startsAt)}{item.dueAt ? ` · Due ${formatNairobiDate(item.dueAt)}` : ''}</p>
          {item.description && <p className="mt-2 text-sm text-slate-700">{item.description}</p>}
        </li>)}</ul>
        : <p className="text-slate-600">No action items are currently assigned to you.</p>}
    </section>
  </div>
}
