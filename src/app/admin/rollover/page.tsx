import Link from 'next/link'
import { z } from 'zod'
import { pagePermission } from '@/lib/page-access'
import { RolloverForm } from '@/components/admin/rollover-form'
import { getSeasonRolloverPage } from '@/modules/seasons/service'
import { suggestedNextSeasonDates } from '@/modules/seasons/rules'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 50

export default async function SeasonRolloverPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pagePermission('seasons:manage')
  const requestedPage = pageSchema.parse((await searchParams).page ?? '1')
  const result = await getSeasonRolloverPage(requestedPage, PAGE_SIZE)
  const { currentSeason, total, members } = result
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const pageMembers = page === requestedPage ? members : (await getSeasonRolloverPage(page, PAGE_SIZE)).members
  const dates = currentSeason ? suggestedNextSeasonDates(currentSeason.endDate) : null
  return <div className="space-y-6">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Super Admin</p><h1>Season management</h1><p className="text-slate-600">Create the next season and carry forward members without overwriting the previous season’s records.</p></div>
    {currentSeason && dates
      ? <section className="card space-y-3"><h2>Current season: {currentSeason.name}</h2><p>When you create the next season, every current membership is carried forward with its season role. New-season fees start at KES 0 owed and paid.</p><RolloverForm members={pageMembers} defaultName={`${dates.startDate.slice(0, 4)} Drama Club Season`} defaultStartDate={dates.startDate} defaultEndDate={dates.endDate} /></section>
      : <section className="card"><h2>No current season</h2><p className="text-slate-600">Ask a Super Admin to initialize the club season before starting a rollover.</p></section>}
    {currentSeason && <p className="text-sm text-slate-500">Page {page} of {pageCount} · {total} active members in the current season</p>}
    <nav className="flex gap-3" aria-label="Season rollover pages">{page > 1 && <Link className="btn-secondary" href={`/admin/rollover?page=${page - 1}`}>Previous</Link>}{page * PAGE_SIZE < total && <Link className="btn-secondary" href={`/admin/rollover?page=${page + 1}`}>Next</Link>}</nav>
  </div>
}
