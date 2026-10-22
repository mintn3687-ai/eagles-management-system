import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { listRehearsals } from '@/lib/rehearsals/service'
import { formatNairobiDate } from '@/lib/dates'
import { CreateRehearsalForm } from '@/components/rehearsals/create-form'

export type SearchParams = { page?: string; status?: string }

export default async function RehearsalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await pageUser('COMMITTEE')
  const params = await searchParams
  const { rehearsals, total, page } = await listRehearsals({ page: params.page, status: params.status })
  return <div className="space-y-6">
    <div>
      <h1>Rehearsals</h1>
      <p className="mb-4 text-slate-600">Schedule, open and close sessions, and manage attendance sheets.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Link className="btn-primary" href="#create-rehearsal">Create rehearsal</Link>
      <Link className="btn-secondary" href="/admin/rehearsals/generate">Generate weekly rehearsals</Link>
    </div>
    <section className="card">
      <form className="grid gap-4 sm:grid-cols-4" method="GET">
        <div><label className="label" htmlFor="status">Status</label><select className="input" id="status" name="status" defaultValue={params.status ?? ''}><option value="">All</option>{['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className="flex items-end"><button className="btn-primary w-full" type="submit">Apply filters</button></div>
      </form>
    </section>
    <section className="card">
      <p>{total} {total === 1 ? 'rehearsal' : 'rehearsals'} · Page {page} of {Math.max(1, Math.ceil(total / 20))}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <caption className="sr-only">Club rehearsals</caption>
          <thead className="bg-stone-100">
            <tr>{['Date', 'Time', 'Venue', 'Status', 'Check-in code', ''].map((h) => <th className="p-4" key={h}>{h || ' '}</th>)}</tr>
          </thead>
          <tbody>
            {rehearsals.slice(0, 20).map((r) => (
              <tr className="border-t border-slate-200" key={r.id}>
                <td className="p-4">{formatNairobiDate(r.date)}</td>
                <td className="p-4">{r.startTime} – {r.endTime}</td>
                <td className="p-4">{r.venue}</td>
                <td className="p-4">{r.status}</td>
                <td className="p-4 font-mono text-2xl">{r.checkInCode ?? '—'}</td>
                <td className="p-4"><Link className="underline" href={`/admin/rehearsals/${r.id}`}>Open</Link></td>
              </tr>
            ))}
            {!rehearsals.length && <tr><td className="p-6" colSpan={6}>No rehearsals match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3" aria-label="Rehearsal pages">
        {page > 1 && <Link className="btn-secondary" href={`/admin/rehearsals?page=${page - 1}&status=${params.status ?? ''}`}>Previous</Link>}
        {rehearsals.length > 20 && <Link className="btn-secondary" href={`/admin/rehearsals?page=${page + 1}&status=${params.status ?? ''}`}>Next</Link>}
      </nav>
    </section>
    <section className="card">
      <h2 id="create-rehearsal">Create a rehearsal</h2>
      <CreateRehearsalForm />
    </section>
  </div>
}
