import Link from 'next/link'
import { pageMember } from '@/lib/page-access'
import { getMemberDashboard, getMemberRehearsal } from '@/lib/rehearsals/service'
import { CheckInForm } from '@/components/rehearsals/check-in-form'
import { AbsentForm } from '@/components/rehearsals/absent-form'
import { formatNairobiDate } from '@/lib/dates'

export default async function MemberAttendancePage({ searchParams }: { searchParams: Promise<{ rehearsalId?: string }> }) {
  const user = await pageMember()
  const { today, next, recent } = await getMemberDashboard()
  const params = await searchParams
  const selected = params.rehearsalId ?? today?.id ?? next?.id
  const result = selected && user.member ? await getMemberRehearsal(selected) : null
  return <div className="space-y-6">
    <Link className="underline" href="/member">Member home</Link>
    <h1>Attendance</h1>
    {result ? <section className="card space-y-4">
      <h2>{result.rehearsal.title}</h2>
      <p>{formatNairobiDate(result.rehearsal.date)} ? {result.rehearsal.startTime} ? {result.rehearsal.endTime} ? {result.rehearsal.venue}</p>
      <p>Session: {result.rehearsal.status}. Your attendance: {result.attendance?.status.replaceAll('_', ' ') ?? 'Not marked'}.</p>
      {result.canPresent && <CheckInForm rehearsalId={result.rehearsal.id} />}
      {result.canAbsent && <AbsentForm rehearsalId={result.rehearsal.id} past={result.past} />}
      {result.attendanceClosed && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Attendance is closed. Members and committee cannot change this rehearsal to present after its scheduled end time.</p>}
      {result.attendance?.reason && <p>Absence reason: {result.attendance.reason}</p>}
      {result.attendance?.reviewNote && <p>Committee note: {result.attendance.reviewNote}</p>}
    </section> : <p>No rehearsal selected.</p>}
    <Link className="btn-secondary" href="/member/history">Attendance history</Link>
    <section className="card"><h2>Recent rehearsals</h2><ul>{recent.map(a => <li key={a.id} className="py-3"><Link className="underline" href={`/member/attendance?rehearsalId=${a.rehearsal.id}`}>{a.rehearsal.title} ? {formatNairobiDate(a.rehearsal.date)}</Link> ? {a.status.replaceAll('_', ' ')}</li>)}</ul></section>
  </div>
}
