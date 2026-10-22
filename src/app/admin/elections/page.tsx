import Link from 'next/link'
import { pagePermission } from '@/lib/page-access'
import { ElectionCreateForm } from '@/components/elections/forms'
import { listAdminElections } from '@/modules/elections/read-service'

export default async function ElectionsPage() {
  await pagePermission('elections:manage')
  const elections = await listAdminElections()
  return <div className="space-y-6">
    <header><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Club governance</p><h1>Elections</h1><p className="text-slate-600">Manage nominations, secret-ballot voting, and result publication.</p></header>
    <ElectionCreateForm />
    <section className="card space-y-4">
      <h2>Election register</h2>
      {elections.length
        ? <ul className="divide-y divide-slate-100">{elections.map((election) => <li className="py-4" key={election.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link className="font-semibold underline" href={`/admin/elections/${election.id}`}>{election.title}</Link>
              <p className="text-sm text-slate-600">{election._count.offices} offices · {election._count.eligibleVoters} eligible · {election.turnoutCount} voted</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{election.status.replaceAll('_', ' ')}</span>
          </div>
        </li>)}</ul>
        : <p className="text-slate-600">No elections have been created.</p>}
    </section>
  </div>
}
