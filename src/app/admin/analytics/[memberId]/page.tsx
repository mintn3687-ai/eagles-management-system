import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { attendancePercent, currentNairobiMonth, formatAnalyticsMonth, getMemberAttendanceHistory, getMemberMissedRehearsals } from '@/lib/attendance-analytics'
import { formatNairobiDate } from '@/lib/dates'
import { analyticsMonthSchema } from '@/lib/validation/analytics'
import { userIdSchema } from '@/lib/validation'
import { z } from 'zod'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 50

export default async function AnalyticsMemberPage({ params, searchParams }: {
  params: Promise<{ memberId: string }>
  searchParams: Promise<{ month?: string | string[]; historyPage?: string | string[]; missedPage?: string | string[] }>
}) {
  await pageUser('COMMITTEE')
  const { memberId } = await params
  if (!userIdSchema.safeParse(memberId).success) notFound()
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, fullName: true, joinedAt: true } })
  if (!member) notFound()

  const currentMonth = currentNairobiMonth()
  const query = await searchParams
  const paramsValue = query.month
  const parsedMonth = analyticsMonthSchema.safeParse(paramsValue)
  const month = parsedMonth.success && parsedMonth.data <= currentMonth ? parsedMonth.data : currentMonth
  const historyRequestedPage = pageSchema.parse(Array.isArray(query.historyPage) ? query.historyPage[0] : query.historyPage)
  const missedRequestedPage = pageSchema.parse(Array.isArray(query.missedPage) ? query.missedPage[0] : query.missedPage)
  const [history, missed] = await Promise.all([
    getMemberAttendanceHistory(member.id, member.joinedAt),
    getMemberMissedRehearsals(member.id, month),
  ])
  const historyRows = history.slice().reverse()
  const historyPageCount = Math.max(1, Math.ceil(historyRows.length / PAGE_SIZE))
  const historyPage = Math.min(historyRequestedPage, historyPageCount)
  const visibleHistory = historyRows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)
  const missedPageCount = Math.max(1, Math.ceil(missed.length / PAGE_SIZE))
  const missedPage = Math.min(missedRequestedPage, missedPageCount)
  const visibleMissed = missed.slice((missedPage - 1) * PAGE_SIZE, missedPage * PAGE_SIZE)

  return <div className="space-y-6">
    <div><Link className="inline-flex min-h-11 items-center underline" href={`/admin/analytics?month=${month}`}>← Monthly analytics</Link><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Member attendance</p><h1>{member.fullName}</h1></div>
    <section className="card">
      <h2>Month-by-month history</h2>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-stone-100"><tr>{['Month', 'Rehearsals counted', 'Present', 'Excused', 'Missed', 'Attendance %'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visibleHistory.map((row) => <tr className="border-t border-slate-200" key={row.month}>
          <td className="p-3"><Link className="underline" href={`/admin/analytics/${member.id}?month=${row.month}`}>{formatAnalyticsMonth(row.month)}</Link></td>
          <td className="p-3">{row.rehearsalsCounted}</td><td className="p-3">{row.present}</td><td className="p-3">{row.excused}</td><td className="p-3">{row.missed}</td><td className="p-3">{attendancePercent(row.present, row.missed).toFixed(1)}%</td>
        </tr>)}</tbody>
      </table></div>
      {historyRows.length > PAGE_SIZE && <nav className="mt-4 flex items-center justify-between" aria-label="History pages">
        <Link className={`btn-secondary ${historyPage <= 1 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={historyPage <= 1} href={`?month=${month}&historyPage=${Math.max(1, historyPage - 1)}`}>Previous</Link>
        <span className="text-sm text-slate-600">Page {historyPage} of {historyPageCount}</span>
        <Link className={`btn-secondary ${historyPage >= historyPageCount ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={historyPage >= historyPageCount} href={`?month=${month}&historyPage=${Math.min(historyPageCount, historyPage + 1)}`}>Next</Link>
      </nav>}
    </section>

    <section className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2>Missed rehearsals</h2><p className="text-sm text-slate-600">Unexcused absences and unreviewed no-responses for {formatAnalyticsMonth(month)}.</p></div>
        <form method="GET" className="flex items-end gap-3"><div><label className="label" htmlFor="missed-month">Month</label><input className="input" id="missed-month" name="month" type="month" max={currentMonth} defaultValue={month} required /></div><button className="btn-primary" type="submit">Show month</button></form>
      </div>
      {missed.length ? <ul className="divide-y divide-slate-200">{visibleMissed.map((rehearsal) => <li className="py-4" key={rehearsal.id}>
        <p className="font-semibold">{formatNairobiDate(rehearsal.date)} · {rehearsal.title}</p>
        <p className="text-sm text-rose-800">{rehearsal.status === 'ABSENT' ? 'Unexcused absence' : 'No response'}</p>
        {rehearsal.reason && <p className="mt-1 text-sm text-slate-600">Reason: {rehearsal.reason}</p>}
      </li>)}</ul> : <p className="text-slate-600">No missed rehearsals for this month.</p>}
      {missed.length > PAGE_SIZE && <nav className="mt-4 flex items-center justify-between" aria-label="Missed rehearsal pages">
        <Link className={`btn-secondary ${missedPage <= 1 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={missedPage <= 1} href={`?month=${month}&missedPage=${Math.max(1, missedPage - 1)}`}>Previous</Link>
        <span className="text-sm text-slate-600">Page {missedPage} of {missedPageCount} · {missed.length} missed rehearsals</span>
        <Link className={`btn-secondary ${missedPage >= missedPageCount ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={missedPage >= missedPageCount} href={`?month=${month}&missedPage=${Math.min(missedPageCount, missedPage + 1)}`}>Next</Link>
      </nav>}
    </section>
  </div>
}
