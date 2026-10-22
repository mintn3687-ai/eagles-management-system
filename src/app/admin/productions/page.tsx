import Link from 'next/link'
import { pagePermission } from '@/lib/page-access'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { AssetForm, AssetMovementForms, ProductionCreateForm } from '@/components/productions/production-forms'
import { listAssets, listCurrentActiveMembers, listProductions } from '@/modules/productions/service'

export default async function ProductionsPage() {
  await pagePermission('productions:manage')
  const [productions, assets, members] = await Promise.all([
    listProductions(), listAssets(), listCurrentActiveMembers(),
  ])
  return <div className="space-y-6">
    <header><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Production management</p><h1>Productions and shows</h1><p className="text-slate-600">Manage productions, rehearsals, cast and crew, show dates, calls, and shared assets.</p></header>
    <ProductionCreateForm today={nairobiDateKey()} />
    <section className="card space-y-4">
      <h2>Production register</h2>
      {productions.length
        ? <ul className="divide-y divide-slate-100">{productions.map((production) => <li className="py-4" key={production.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link className="font-semibold underline" href={`/admin/productions/${production.id}`}>{production.title}</Link>
              <p className="text-sm text-slate-600">{production.startDate ? formatNairobiDate(production.startDate) : 'Start date not set'}{production.endDate ? ` – ${formatNairobiDate(production.endDate)}` : ''}</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{production.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{production._count.showDates} show date{production._count.showDates === 1 ? '' : 's'} · {production._count.tasks} task{production._count.tasks === 1 ? '' : 's'}</p>
        </li>)}</ul>
        : <p className="text-slate-600">No productions have been created yet.</p>}
    </section>
    <section className="card space-y-4">
      <h2>Shared asset register</h2>
      <p className="text-sm text-slate-600">Assets can be assigned to a production or held in the shared club inventory.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <AssetForm />
        <AssetMovementForms assets={assets} members={members} />
      </div>
      {assets.length
        ? <ul className="divide-y divide-slate-100">{assets.map((asset) => <li className="py-3" key={asset.id}>
          <p className="font-semibold">{asset.name} <span className="font-normal text-slate-600">· {asset.category.toLowerCase()} · {asset.condition.toLowerCase().replaceAll('_', ' ')}</span></p>
          <p className="text-sm text-slate-600">{asset.production ? `${asset.production.title} · ` : 'Shared · '}{asset.status === 'CHECKED_OUT' ? `Checked out to ${asset.currentHolder?.fullName ?? 'unknown member'}` : asset.status.toLowerCase().replaceAll('_', ' ')}</p>
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No assets recorded yet.</p>}
    </section>
  </div>
}
