import Link from 'next/link'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { pagePermission } from '@/lib/page-access'
import { FestivalCreateForm } from '@/components/festivals/festival-forms'
import { listFestivals } from '@/modules/festivals/service'

function festivalDates(startDate: Date | null, endDate: Date | null) {
  if (!startDate && !endDate) return 'Dates not set'
  if (startDate && endDate) return `${formatNairobiDate(startDate)} – ${formatNairobiDate(endDate)}`
  return formatNairobiDate(startDate ?? endDate!)
}

export default async function FestivalsPage() {
  await pagePermission('festivals:manage')
  const festivals = await listFestivals()
  const today = nairobiDateKey()

  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Festival planning</p>
      <h1>Kenya National Drama Festivals</h1>
      <p className="text-slate-600">Track festival plans here. Entries, budgets, approvals, and logistics will be added in subsequent phases.</p>
    </header>

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
