import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { listMemberElections } from '@/modules/elections/read-service'

export default async function MemberElectionsPage() {
  const user = await pagePermission('elections:vote')
  if (!user.member) redirect('/forbidden')
  const elections = await listMemberElections(user.member.id)
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/member">Back to home</Link>
    <header><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Club governance</p><h1>Elections</h1><p className="text-slate-600">Nominate yourself, vote by secret ballot, and view published results.</p></header>
    <section className="card space-y-4">
      {elections.length
        ? <ul className="divide-y divide-slate-100">{elections.map((election) => <li className="py-4" key={election.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link className="font-semibold underline" href={`/member/elections/${election.id}`}>{election.title}</Link>
              <p className="text-sm text-slate-600">{election.offices.length} offices · {election.offices.reduce((count, office) => count + office.nominations.length, 0)} approved candidates</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{election.status.replaceAll('_', ' ')}</span>
          </div>
        </li>)}</ul>
        : <p className="text-slate-600">There are no open elections or published results.</p>}
    </section>
  </div>
}
