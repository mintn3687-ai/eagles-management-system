import Link from 'next/link'
import { pagePermission } from '@/lib/page-access'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { MeetingCreateForm } from '@/components/meetings/meeting-forms'
import { listMeetings } from '@/modules/meetings/read-service'

export default async function MeetingsPage() {
  await pagePermission('meetings:manage')
  const meetings = await listMeetings()
  return <div className="space-y-6">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Governance</p><h1>Meetings</h1><p className="text-slate-600">Schedule meetings, track quorum, approve minutes, and follow motions and action items.</p></div>
    <MeetingCreateForm today={nairobiDateKey()} />
    <section className="card space-y-4">
      <h2>Meeting register</h2>
      {meetings.length
        ? <ul className="divide-y divide-slate-100">
          {meetings.map((meeting) => <li className="py-4" key={meeting.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link className="font-semibold underline" href={`/admin/meetings/${meeting.id}`}>{meeting.title}</Link>
                <p className="text-sm text-slate-600">{formatNairobiDate(meeting.startsAt, true)} · {meeting.venue}</p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{meeting.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Quorum: {meeting.quorum.attendedCount}/{meeting.quorum.eligibleCount} present, {meeting.quorum.requiredCount} required
              · Minutes {meeting.minutesStatus.toLowerCase()}
              · {meeting._count.motions} motion{meeting._count.motions === 1 ? '' : 's'}
              · {meeting._count.actionItems} action item{meeting._count.actionItems === 1 ? '' : 's'}
            </p>
          </li>)}
        </ul>
        : <p className="text-slate-600">No meetings have been created.</p>}
    </section>
  </div>
}
