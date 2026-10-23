import Link from 'next/link'
import { pagePermission } from '@/lib/page-access'
import { listAbsences, countPendingAbsences } from '@/modules/absences/service'
import { absenceListSchema } from '@/modules/absences/schema'
import { AbsenceFiltersComponent } from '@/components/absences/filters'
import { AbsenceList } from '@/components/absences/list'

export type SearchParams = {
  page?: string; rehearsalId?: string; memberId?: string; status?: string; month?: string
}

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await pagePermission('absences:manage')
  const params = await searchParams
  const filters = absenceListSchema.parse(params)
  const { records, total, page } = await listAbsences(filters)
  const pendingCount = await countPendingAbsences()
  return <div className="space-y-6">
    <div>
      <h1>Absence reviews <span className="ml-3 inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium h-6 w-6">{pendingCount}</span></h1>
      <p className="text-slate-600">Review pending absence reasons from members.</p>
    </div>
    <AbsenceFiltersComponent filters={filters} />
    <AbsenceList records={records.slice(0, 20)} />
    <nav className="flex gap-3" aria-label="Absence pages">
      {page > 1 && <Link className="btn-secondary" href={`/admin/absences?page=${page - 1}&rehearsalId=${filters.rehearsalId ?? ''}&memberId=${filters.memberId ?? ''}&status=${filters.status ?? ''}&month=${filters.month ?? ''}`}>Previous</Link>}
      {records.length > 20 && <Link className="btn-secondary" href={`/admin/absences?page=${page + 1}&rehearsalId=${filters.rehearsalId ?? ''}&memberId=${filters.memberId ?? ''}&status=${filters.status ?? ''}&month=${filters.month ?? ''}`}>Next</Link>}
    </nav>
    <p className="text-sm text-slate-500">{total} {total === 1 ? 'record' : 'records'} · Page {page} of {Math.max(1, Math.ceil(total / 20))}</p>
  </div>
}