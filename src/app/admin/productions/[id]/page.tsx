import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import {
  AssetForm,
  AssetMovementForms,
  CallSheetForm,
  CastingForm,
  CrewForm,
  PostShowNoteForm,
  ProductionStatusForm,
  RehearsalLinkForm,
  RoleForm,
  ScriptVersionForm,
  ShowDateForm,
  TaskForm,
  TaskStatusForm,
} from '@/components/productions/production-forms'
import {
  getProductionDetail,
  listAvailableRehearsals,
  listCurrentActiveMembers,
} from '@/modules/productions/service'

export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await pagePermission('productions:manage')
  const { id } = await params
  const [production, members, rehearsals] = await Promise.all([
    getProductionDetail(id),
    listCurrentActiveMembers(),
    listAvailableRehearsals(),
  ])
  if (!production) notFound()
  const roles = production.roles.map(({ id: roleId, name }) => ({ id: roleId, name }))
  const shows = production.showDates.map(({ id: showId, startsAt, venue }) => ({ id: showId, startsAt, venue }))
  const noteShowLabel = (showDateId: string | null) => {
    if (!showDateId) return 'General production note'
    const show = production.showDates.find((item) => item.id === showDateId)
    return show ? formatNairobiDate(show.startsAt) : 'Show date unavailable'
  }
  const today = nairobiDateKey()
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/admin/productions">Back to productions</Link>
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Production</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1>{production.title}</h1><p className="text-slate-600">{production.description || 'No description provided.'}</p></div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{production.status.replaceAll('_', ' ')}</span>
      </div>
      <ProductionStatusForm productionId={production.id} status={production.status} />
    </header>

    <section className="card space-y-4">
      <h2>Scripts and rights</h2>
      <ScriptVersionForm productionId={production.id} />
      {production.scriptVersions.length
        ? <ul className="space-y-3">{production.scriptVersions.map((script) => <li className="rounded-lg border border-slate-200 p-4" key={script.id}>
          <h3>{script.version}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{script.usageRightsNotes}</p>
          {script.storageReference && <p className="mt-1 break-all text-sm text-slate-600">Storage reference: {script.storageReference}</p>}
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No script versions recorded.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Cast and crew</h2>
      <div className="grid gap-4 md:grid-cols-2"><RoleForm productionId={production.id} /><CastingForm productionId={production.id} roles={roles} members={members} /><CrewForm productionId={production.id} members={members} /></div>
      {production.roles.length
        ? <ul className="space-y-3">{production.roles.map((role) => <li className="rounded-lg border border-slate-200 p-4" key={role.id}>
          <h3>{role.name}</h3>{role.description && <p className="text-sm text-slate-600">{role.description}</p>}
          {role.castings.length
            ? <ul className="mt-2 list-disc pl-5 text-sm">{role.castings.map((casting) => <li key={casting.id}>{casting.member.fullName} · {casting.type === 'CAST' ? 'Cast' : 'Understudy'}</li>)}</ul>
            : <p className="mt-2 text-sm text-slate-500">No cast assigned.</p>}
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No production roles recorded.</p>}
      <div><h3>Crew assignments</h3>{production.crew.length
        ? <ul className="list-disc pl-5 text-sm">{production.crew.map((crew) => <li key={crew.id}>{crew.member.fullName} · {crew.assignment}</li>)}</ul>
        : <p className="text-sm text-slate-600">No crew assignments recorded.</p>}</div>
    </section>

    <section className="card space-y-4">
      <h2>Production tasks</h2><TaskForm productionId={production.id} members={members} />
      {production.tasks.length
        ? <ul className="space-y-3">{production.tasks.map((task) => <li className="rounded-lg border border-slate-200 p-4" key={task.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div>
            <h3>{task.title}</h3><p className="text-sm text-slate-600">{task.owner?.fullName ?? 'Unassigned'}{task.deadline ? ` · Due ${formatNairobiDate(task.deadline)}` : ''}</p>
            {task.description && <p className="mt-1 text-sm">{task.description}</p>}
          </div><span className="text-sm">{task.status.replaceAll('_', ' ')}</span></div>
          <div className="mt-3"><TaskStatusForm productionId={production.id} taskId={task.id} status={task.status} /></div>
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No tasks recorded.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Rehearsals</h2>
      <RehearsalLinkForm productionId={production.id} rehearsals={rehearsals} />
      {production.rehearsals.length
        ? <ul className="list-disc pl-5 text-sm">{production.rehearsals.map((rehearsal) => <li key={rehearsal.id}>{rehearsal.title} · {formatNairobiDate(rehearsal.date)} · {rehearsal.status.toLowerCase()}</li>)}</ul>
        : <p className="text-sm text-slate-600">No rehearsals linked.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Shows and call sheets</h2><ShowDateForm productionId={production.id} today={today} />
      <CallSheetForm productionId={production.id} shows={shows} members={members} />
      {production.showDates.length
        ? <ul className="space-y-3">{production.showDates.map((show) => <li className="rounded-lg border border-slate-200 p-4" key={show.id}>
          <h3>{formatNairobiDate(show.startsAt, true)} · {show.venue}</h3>
          {show.callSheets.length
            ? <ul className="mt-2 space-y-2">{show.callSheets.map((sheet) => <li className="text-sm" key={sheet.id}>
              <p className="font-semibold">{sheet.title} · Call {formatNairobiDate(sheet.callAt, true)}</p>
              {sheet.notes && <p>{sheet.notes}</p>}
              <p>Called: {sheet.members.map(({ member }) => member.fullName).join(', ') || 'No members'}</p>
            </li>)}</ul>
            : <p className="mt-2 text-sm text-slate-600">No call sheets recorded.</p>}
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No show dates scheduled.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Assets</h2><AssetForm productionId={production.id} />
      <AssetMovementForms productionId={production.id} assets={production.assets} members={members} />
      {production.assets.length
        ? <ul className="divide-y divide-slate-100">{production.assets.map((asset) => <li className="py-3" key={asset.id}>
          <p className="font-semibold">{asset.name} <span className="font-normal text-slate-600">· {asset.category.toLowerCase()} · {asset.condition.toLowerCase().replaceAll('_', ' ')}</span></p>
          <p className="text-sm text-slate-600">{asset.status === 'CHECKED_OUT' ? `Checked out to ${asset.currentHolder?.fullName ?? 'unknown member'}` : asset.status.toLowerCase().replaceAll('_', ' ')}</p>
        </li>)}</ul>
        : <p className="text-sm text-slate-600">No assets assigned to this production.</p>}
    </section>

    <section className="card space-y-4">
      <h2>Post-show notes</h2><PostShowNoteForm productionId={production.id} shows={shows} />
      {[...production.postShowNotes, ...production.showDates.flatMap((show) => show.postShowNotes)].map((note) => <article className="rounded-lg border border-slate-200 p-4" key={note.id}>
        <p className="text-sm text-slate-600">{noteShowLabel(note.showDateId)} · {formatNairobiDate(note.createdAt)}</p>
        <p className="mt-2 whitespace-pre-wrap">{note.note}</p>
      </article>)}
    </section>
  </div>
}
