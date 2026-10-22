import Link from 'next/link'
import { pageMember } from '@/lib/page-access'
import { listMemberHistory } from '@/lib/rehearsals/service'
import { formatNairobiDate } from '@/lib/dates'

export default async function MemberHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageMember()
  const params = await searchParams
  const { records, total, page } = await listMemberHistory({ page: params.page })
  return <div className="space-y-6">
    <div>
      <Link className="inline-flex min-h-11 items-center underline" href="/member">← Member home</Link>
      <h1>Attendance history</h1>
    </div>
    <section className="card">
      <p>{total} {total === 1 ? 'record' : 'records'} · Page {page} of {Math.max(1, Math.ceil(total / 20))}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <caption className="sr-only">Attendance history</caption>
          <thead className="bg-stone-100">
            <tr>{['Date', 'Rehearsal', 'Status', 'Reason', 'Review', 'Committee note', ''].map((h) => <th className="p-4" key={h}>{h || ' '}</th>)}</tr>
          </thead>
          <tbody>
            {records.slice(0, 20).map((r) => (
              <tr className="border-t border-slate-200" key={r.id}>
                <td className="p-4">{formatNairobiDate(r.rehearsal.date)}</td>
                <td className="p-4">{r.rehearsal.title}</td>
                <td className="p-4 font-medium">{r.status.replaceAll('_', ' ')}</td>
                <td className="p-4">{r.reason ?? '—'}</td>
                <td className="p-4">{r.reviewStatus === 'NONE' ? '—' : r.reviewStatus.replaceAll('_', ' ')}</td>
                <td className="p-4">{r.reviewNote ?? '—'}</td>
                <td className="p-4"><Link className="underline" href={`/member/attendance?rehearsalId=${r.rehearsal.id}`}>Details</Link></td>
              </tr>
            ))}
            {!records.length && <tr><td className="p-6" colSpan={7}>No attendance records yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3" aria-label="History pages">
        {page > 1 && <Link className="btn-secondary" href={`/member/history?page=${page - 1}`}>Previous</Link>}
        {records.length > 20 && <Link className="btn-secondary" href={`/member/history?page=${page + 1}`}>Next</Link>}
      </nav>
    </section>
    <Link className="btn-secondary" href="/member/attendance">Back to attendance</Link>
  </div>
}
