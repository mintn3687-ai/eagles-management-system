import Link from 'next/link'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { pagePermission } from '@/lib/page-access'
import { formatKES } from '@/lib/money'
import { FestivalCreateForm } from '@/components/festivals/festival-forms'
import { getFestivalDashboard, listFestivals } from '@/modules/festivals/service'

function festivalDates(startDate: Date | null, endDate: Date | null) {
  if (!startDate && !endDate) return 'Dates not set'
  if (startDate && endDate) return `${formatNairobiDate(startDate)} – ${formatNairobiDate(endDate)}`
  return formatNairobiDate(startDate ?? endDate!)
}

export default async function FestivalsPage() {
  await pagePermission('festivals:manage')
  await pagePermission('finance:manage')
  const today = nairobiDateKey()
  const [festivals, dashboard] = await Promise.all([
    listFestivals(),
    getFestivalDashboard(today),
  ])
  const overdueDeadlines = dashboard.deadlines.filter((deadline) => deadline.overdue).length

  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Festival planning</p>
      <h1>Kenya National Drama Festivals</h1>
      <p className="text-slate-600">Track festival invitations, entries, deadlines, budgets, approvals, and logistics from each festival plan.</p>
    </header>

    <section aria-label="Festival planning overview" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card space-y-1">
          <h2 className="text-base">Upcoming and active festivals</h2>
          <p className="text-2xl font-semibold">{dashboard.upcomingFestivalCount}</p>
        </div>
        <div className="card space-y-1">
          <h2 className="text-base">Deadlines needing attention</h2>
          <p className="text-2xl font-semibold">{dashboard.deadlines.length}</p>
          <p className="text-sm text-slate-600">{overdueDeadlines} overdue</p>
        </div>
        <div className="card space-y-1">
          <h2 className="text-base">Pending approvals</h2>
          <p className="text-2xl font-semibold">{dashboard.pendingApprovals}</p>
        </div>
        <div className="card space-y-1">
          <h2 className="text-base">Incomplete logistics</h2>
          <p className="text-2xl font-semibold">{dashboard.incompleteLogistics}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2>Upcoming and active festivals</h2>
          {dashboard.upcomingFestivals.length ? <ul className="divide-y divide-slate-100">
            {dashboard.upcomingFestivals.map((festival) => <li className="py-2" key={festival.id}>
              <Link className="font-semibold text-emerald-900 underline" href={`/admin/festivals/${festival.id}`} prefetch={false}>
                {festival.name} {festival.year}
              </Link>
              <p className="text-sm text-slate-600">{festivalDates(festival.startDate, festival.endDate)} · {festival.status.toLowerCase()}</p>
            </li>)}
          </ul> : <p className="text-slate-600">No upcoming festival plans. Create one below.</p>}
        </section>

        <section className="card space-y-3">
          <h2>Deadlines and overdue items</h2>
          {dashboard.deadlines.length ? <ul className="divide-y divide-slate-100">
            {dashboard.deadlines.map((deadline) => <li className="py-2" key={deadline.id}>
              <p className="font-medium">{deadline.title}</p>
              <p className="text-sm text-slate-600">
                {deadline.kind} · {deadline.festivalName} · {formatNairobiDate(deadline.dueAt)}
                {deadline.overdue && <span className="ml-2 font-semibold text-red-700">Overdue</span>}
              </p>
              <Link className="text-sm text-emerald-900 underline" href={`/admin/festivals/${deadline.festivalId}`} prefetch={false}>Open festival</Link>
            </li>)}
          </ul> : <p className="text-slate-600">No open deadlines in the overdue or next 30-day window.</p>}
        </section>
      </div>

      <section className="space-y-3">
        <h2>Festival status and budget overview</h2>
        {dashboard.summaries.length ? <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.summaries.map((festival) => <article className="card space-y-2" key={festival.id}>
            <h3><Link className="text-emerald-900 underline" href={`/admin/festivals/${festival.id}`} prefetch={false}>{festival.name} {festival.year}</Link></h3>
            <p className="text-sm text-slate-600">
              Entries: {festival.entryStatusCounts.PENDING ?? 0} pending · {festival.entryStatusCounts.PREPARING ?? 0} preparing · {festival.entryStatusCounts.SUBMITTED ?? 0} submitted · {festival.entryStatusCounts.CONFIRMED ?? 0} confirmed · {festival.entryStatusCounts.REJECTED ?? 0} not accepted
            </p>
            <p className="text-sm text-slate-600">
              Approvals: {festival.pendingPlanApproval ? 'plan pending' : 'no plan approval pending'} · {festival.pendingBudgetApprovals} budget pending
            </p>
            <p className="text-sm text-slate-600">
              Logistics incomplete: {festival.incompleteLogistics}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm">Income · planned {formatKES(festival.budgetSummary.INCOME.planned)} · approved {formatKES(festival.budgetSummary.INCOME.approved)} · actual {formatKES(festival.budgetSummary.INCOME.actual)}</p>
              <p className="text-sm">Expenses · planned {formatKES(festival.budgetSummary.EXPENSE.planned)} · approved {formatKES(festival.budgetSummary.EXPENSE.approved)} · actual {formatKES(festival.budgetSummary.EXPENSE.actual)}</p>
            </div>
          </article>)}
        </div> : <p className="card text-slate-600">Create or schedule a festival to see its planning overview.</p>}
      </section>
    </section>

    <FestivalCreateForm today={today} />

    <section className="card space-y-3">
      <h2>Festival register</h2>
      {festivals.length ? <ul className="divide-y divide-slate-100">
        {festivals.map((festival) => <li className="py-3" key={festival.id}>
          <Link className="font-semibold text-emerald-900 underline" href={`/admin/festivals/${festival.id}`} prefetch={false}>{festival.name} {festival.year}</Link>
          <p className="text-sm text-slate-600">{festivalDates(festival.startDate, festival.endDate)} · {festival.status.replaceAll('_', ' ').toLowerCase()}</p>
          {festival.organizer && <p className="text-sm text-slate-600">{festival.organizer}</p>}
        </li>)}
      </ul> : <p className="text-slate-600">No festival plans yet. Add an invitation or festival to get started.</p>}
    </section>
  </div>
}
