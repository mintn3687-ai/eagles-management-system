import { notFound } from 'next/navigation'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { pagePermission } from '@/lib/page-access'
import { FestivalUpdateForm } from '@/components/festivals/festival-forms'
import { getFestival } from '@/modules/festivals/service'

export default async function FestivalDetailPage({ params }: {
  params: Promise<{ festivalId: string }>
}) {
  await pagePermission('festivals:manage')
  const { festivalId } = await params
  const festival = await getFestival(festivalId)
  if (!festival) notFound()
  const today = nairobiDateKey()

  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Festival plan · {festival.year}</p>
      <h1>{festival.name}</h1>
      {festival.startDate && <p className="text-slate-600">
        {formatNairobiDate(festival.startDate)}{festival.endDate ? ` – ${formatNairobiDate(festival.endDate)}` : ''}
      </p>}
    </header>
    <FestivalUpdateForm festival={festival} today={today} />
  </div>
}
