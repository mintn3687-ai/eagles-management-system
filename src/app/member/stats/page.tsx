import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pageMember } from '@/lib/page-access'
import { attendancePercent, currentNairobiMonth, formatAnalyticsMonth, getMonthlyAttendance } from '@/lib/attendance-analytics'
import { analyticsMonthSchema } from '@/lib/validation/analytics'

export default async function MemberStatsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const user = await pageMember()
  const memberId = user.member?.id
  if (!memberId) redirect('/forbidden')
  const currentMonth = currentNairobiMonth()
  const params = await searchParams
  const parsedMonth = analyticsMonthSchema.safeParse(params.month)
  const month = parsedMonth.success && parsedMonth.data <= currentMonth ? parsedMonth.data : currentMonth
  const rows = await getMonthlyAttendance(month, memberId)
  const stats = rows.find((row) => row.memberId === memberId)
  const present = stats?.present ?? 0
  const missed = stats?.missed ?? 0
  const excused = stats?.excused ?? 0
  const percent = attendancePercent(present, missed)

  return <div className="space-y-6">
    <div><Link className="inline-flex min-h-11 items-center underline" href="/member">← Member home</Link><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Your attendance</p><h1>Monthly stats</h1></div>
    <section className="card flex flex-wrap items-end justify-between gap-4">
      <p className="text-slate-600">Showing {formatAnalyticsMonth(month)}</p>
      <form method="GET" className="flex flex-wrap items-end gap-3"><div><label className="label" htmlFor="month">Month</label><input className="input" id="month" name="month" type="month" max={currentMonth} defaultValue={month} required /></div><button className="btn-primary" type="submit">Show month</button></form>
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      <article className="card border-l-4 border-emerald-600"><p className="text-sm text-emerald-800">Present</p><p className="mt-2 text-3xl font-semibold text-emerald-950">{present}</p></article>
      <article className="card border-l-4 border-rose-600"><p className="text-sm text-rose-800">Missed (unexcused / no response)</p><p className="mt-2 text-3xl font-semibold text-rose-950">{missed}</p></article>
    </section>
    <section className="card space-y-2"><h2>Your attendance percentage</h2><p className="text-4xl font-semibold text-emerald-950">{percent.toFixed(1)}%</p><p className="text-sm text-slate-600">{present} present ÷ ({present} present + {missed} missed). Excused absences ({excused}) are shown separately and do not count against you.</p></section>
  </div>
}
