import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import {
  attendancePercent,
  countClosedRehearsals,
  currentNairobiMonth,
  formatAnalyticsMonth,
  getAttendanceTrend,
  getAttendanceThreshold,
  getMonthRange,
  getMonthlyAttendance,
  listAnalyticsMembers,
} from '@/lib/attendance-analytics'
import { analyticsDirectionSchema, analyticsMonthSchema, analyticsSortSchema } from '@/lib/validation/analytics'
import { MemberAttendanceCharts } from '@/components/admin/member-attendance-charts'
import { z } from 'zod'

type SearchParams = { month?: string | string[]; sort?: string | string[]; direction?: string | string[]; page?: string | string[] }
const analyticsPageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 50

function selectedMonth(value: string | string[] | undefined, currentMonth: string) {
  const parsed = analyticsMonthSchema.safeParse(value)
  return parsed.success && parsed.data <= currentMonth ? parsed.data : currentMonth
}

function queryHref(month: string, sort: string, direction: string, page = 1) {
  return `/admin/analytics?${new URLSearchParams({ month, sort, direction, page: String(page) })}`
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await pageUser('COMMITTEE')
  const params = await searchParams
  const currentMonth = currentNairobiMonth()
  const month = selectedMonth(params.month, currentMonth)
  const sortResult = analyticsSortSchema.safeParse(params.sort)
  const directionResult = analyticsDirectionSchema.safeParse(params.direction)
  const requestedPage = analyticsPageSchema.parse(Array.isArray(params.page) ? params.page[0] : params.page)
  const sort = sortResult.success ? sortResult.data : 'name'
  const direction = directionResult.success ? directionResult.data : 'asc'
  const { start, end } = getMonthRange(month)
  const [stats, rehearsalsHeld, threshold, members] = await Promise.all([
    getMonthlyAttendance(month),
    countClosedRehearsals(start, end),
    getAttendanceThreshold(),
    listAnalyticsMembers(month),
  ])

  const statByMember = new Map(stats.map((row) => [row.memberId, row]))
  const rows = members.map((member) => {
    const stat = statByMember.get(member.id)
    return stat ?? { memberId: member.id, memberName: member.fullName, month, rehearsalsCounted: 0, present: 0, excused: 0, missed: 0 }
  })
  rows.sort((left, right) => {
    const leftValue = sort === 'name' ? left.memberName.toLocaleLowerCase() : sort === 'counted' ? left.rehearsalsCounted : sort === 'present' ? left.present : sort === 'excused' ? left.excused : sort === 'missed' ? left.missed : attendancePercent(left.present, left.missed)
    const rightValue = sort === 'name' ? right.memberName.toLocaleLowerCase() : sort === 'counted' ? right.rehearsalsCounted : sort === 'present' ? right.present : sort === 'excused' ? right.excused : sort === 'missed' ? right.missed : attendancePercent(right.present, right.missed)
    const order = typeof leftValue === 'string' && typeof rightValue === 'string' ? leftValue.localeCompare(rightValue) : Number(leftValue) - Number(rightValue)
    return order * (direction === 'asc' ? 1 : -1) || left.memberName.localeCompare(right.memberName)
  })

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const present = rows.reduce((total, row) => total + row.present, 0)
  const excused = rows.reduce((total, row) => total + row.excused, 0)
  const missed = rows.reduce((total, row) => total + row.missed, 0)
  const clubPercent = attendancePercent(present, missed)
  const trend = await getAttendanceTrend(month)

  const sortLink = (key: string) => queryHref(month, key, sort === key && direction === 'asc' ? 'desc' : 'asc')
  const exportHref = `/admin/analytics/export?month=${encodeURIComponent(month)}`

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Attendance</p><h1>Monthly analytics</h1></div>
      <Link className="btn-secondary" href={exportHref}>Export CSV</Link>
    </div>

    <section className="card flex flex-wrap items-end justify-between gap-4">
      <div><h2>Choose a Nairobi month</h2><p className="text-sm text-slate-600">{formatAnalyticsMonth(month)}</p></div>
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="month">Month</label><input className="input" id="month" name="month" type="month" max={currentMonth} defaultValue={month} required /></div>
        <button className="btn-primary" type="submit">Show month</button>
      </form>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label={`${formatAnalyticsMonth(month)} club summary`}>
      <article className="card"><p className="text-sm text-slate-600">Rehearsals held</p><p className="mt-2 text-3xl font-semibold">{rehearsalsHeld}</p></article>
      <article className="card"><p className="text-sm text-slate-600">Average attendance</p><p className="mt-2 text-3xl font-semibold">{clubPercent.toFixed(1)}%</p></article>
      <article className="card"><p className="text-sm text-emerald-800">Present</p><p className="mt-2 text-3xl font-semibold text-emerald-900">{present}</p></article>
      <article className="card"><p className="text-sm text-amber-800">Excused</p><p className="mt-2 text-3xl font-semibold text-amber-900">{excused}</p></article>
      <article className="card"><p className="text-sm text-rose-800">Missed (unexcused / no response)</p><p className="mt-2 text-3xl font-semibold text-rose-900">{missed}</p></article>
    </section>

    <MemberAttendanceCharts rows={rows} monthLabel={formatAnalyticsMonth(month)} />

    <section className="card">
      <h2>Six-month attendance trend</h2>
      <p className="mb-5 text-sm text-slate-600">Each month uses present ÷ (present + missed). Excused absences are excluded.</p>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6" role="img" aria-label={`Six-month club attendance trend ending ${formatAnalyticsMonth(month)}`}>
        {trend.map((item) => <div key={item.month} className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm font-semibold">{item.percent.toFixed(1)}%</span>
          <div className="flex h-32 w-full items-end rounded-lg bg-stone-100 p-1"><div className="w-full rounded-md bg-emerald-700" style={{ height: `${item.percent}%` }} /></div>
          <span className="text-xs text-slate-600">{formatAnalyticsMonth(item.month)}</span>
        </div>)}
      </div>
    </section>

    <section className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2>Member attendance</h2><p className="text-sm text-slate-600">Red flags mark attendance below the {threshold}% threshold.</p></div></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-stone-100"><tr>
            {([['name', 'Member'], ['counted', 'Rehearsals counted'], ['present', 'Present'], ['excused', 'Excused'], ['missed', 'Unexcused / missed'], ['attendance', 'Attendance %']] as const).map(([key, label]) => <th className="p-3" key={key}><Link className="underline" href={sortLink(key)}>{label}{sort === key ? direction === 'asc' ? ' ↑' : ' ↓' : ''}</Link></th>)}
          </tr></thead>
          <tbody>
            {pageRows.map((row) => {
              const percent = attendancePercent(row.present, row.missed)
              const flagged = percent < threshold
              return <tr key={row.memberId} className="border-t border-slate-200">
                <td className="p-3"><Link className="font-medium underline" href={`/admin/analytics/${row.memberId}?month=${month}`}>{row.memberName}</Link></td>
                <td className="p-3">{row.rehearsalsCounted}</td><td className="p-3">{row.present}</td><td className="p-3">{row.excused}</td><td className="p-3">{row.missed}</td>
                <td className="p-3">{percent.toFixed(1)}% {flagged && <span className="ml-1 inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-900">Below threshold</span>}</td>
              </tr>
            })}
            {!rows.length && <tr><td className="p-5 text-slate-600" colSpan={6}>No active members to report.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE_SIZE && <nav className="mt-4 flex items-center justify-between" aria-label="Member table pages">
        <Link className={`btn-secondary ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={page <= 1} href={queryHref(month, sort, direction, Math.max(1, page - 1))}>Previous</Link>
        <span className="text-sm text-slate-600">Page {page} of {pageCount} · {rows.length} members</span>
        <Link className={`btn-secondary ${page >= pageCount ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={page >= pageCount} href={queryHref(month, sort, direction, Math.min(pageCount, page + 1))}>Next</Link>
      </nav>}
    </section>
  </div>
}
