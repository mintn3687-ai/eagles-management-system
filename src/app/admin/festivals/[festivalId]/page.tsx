import { notFound } from 'next/navigation'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import { pagePermission } from '@/lib/page-access'
import {
  FestivalBudgetItemForm,
  FestivalCategoryForm,
  FestivalEntryForm,
  FestivalEntryStatusForm,
  FestivalFinanceLinkForm,
  FestivalFinanceUnlinkForm,
  FestivalInvitationForm,
  FestivalInvitationStatusForm,
  FestivalUpdateForm,
} from '@/components/festivals/festival-forms'
import { getFestival, getFestivalPlanning } from '@/modules/festivals/service'
import { isEntryOverdue, isInvitationOverdue } from '@/modules/festivals/rules'

export default async function FestivalDetailPage({ params }: {
  params: Promise<{ festivalId: string }>
}) {
  await pagePermission('festivals:manage')
  await pagePermission('finance:manage')
  const { festivalId } = await params
  const festival = await getFestival(festivalId)
  if (!festival) notFound()
  const today = nairobiDateKey()
  const planning = await getFestivalPlanning(festivalId)

  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Festival plan · {festival.year}</p>
      <h1>{festival.name}</h1>
      {festival.startDate && <p className="text-slate-600">
        {formatNairobiDate(festival.startDate)}{festival.endDate ? ` – ${formatNairobiDate(festival.endDate)}` : ''}
      </p>}
    </header>
    <FestivalUpdateForm festival={festival} today={today} />

    <section className="space-y-4">
      <header>
        <h2>Invitations and response deadlines</h2>
        <p className="text-slate-600">Record invitation dates and the response deadline supplied by the organizer.</p>
      </header>
      <FestivalInvitationForm festivalId={festivalId} today={today} />
      <div className="card space-y-3">
        <h3>Invitation register</h3>
        {planning.invitations.length ? <ul className="divide-y divide-slate-100">
          {planning.invitations.map((invitation) => {
            const overdue = isInvitationOverdue(
              invitation.status,
              invitation.responseDeadline ? nairobiDateKey(invitation.responseDeadline) : null,
              today,
            )
            return <li className="space-y-2 py-3" key={invitation.id}>
              <p className="font-medium">Received {formatNairobiDate(invitation.receivedAt)} · {invitation.status.toLowerCase()}</p>
              <p className="text-sm text-slate-600">
                Response deadline: {invitation.responseDeadline ? formatNairobiDate(invitation.responseDeadline) : 'Not set'}
                {overdue && <span className="ml-2 font-semibold text-red-700">Overdue</span>}
              </p>
              {invitation.notes && <p className="text-sm text-slate-600">{invitation.notes}</p>}
              {invitation.status === 'RECEIVED' && <FestivalInvitationStatusForm festivalId={festivalId} invitationId={invitation.id} />}
            </li>
          })}
        </ul> : <p className="text-slate-600">No invitations recorded yet.</p>}
      </div>
    </section>

    <section className="space-y-4">
      <header>
        <h2>Competition entries and deadlines</h2>
        <p className="text-slate-600">Configure the festival’s categories and deadlines; these are not assumed or hardcoded.</p>
      </header>
      <FestivalCategoryForm festivalId={festivalId} />
      <div className="card space-y-3">
        <h3>Configured categories</h3>
        {planning.categories.length ? <ul className="divide-y divide-slate-100">
          {planning.categories.map((category) => <li className="py-2" key={category.id}>
            <span className="font-medium">{category.name}</span>
            {' · Default deadline: '}
            {category.defaultDeadline ? formatNairobiDate(category.defaultDeadline) : 'Not set'}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-emerald-800">Edit category</summary>
              <div className="mt-2"><FestivalCategoryForm festivalId={festivalId} category={category} /></div>
            </details>
          </li>)}
        </ul> : <p className="text-slate-600">No categories configured yet.</p>}
      </div>
      {planning.categories.length > 0
        ? <FestivalEntryForm festivalId={festivalId} categories={planning.categories} productions={planning.productionOptions} />
        : <p className="card text-slate-600">Add a festival category before creating an entry.</p>}
      <div className="card space-y-3">
        <h3>Entry register</h3>
        {planning.entries.length ? <ul className="divide-y divide-slate-100">
          {planning.entries.map((entry) => {
            const overdue = isEntryOverdue(
              entry.status,
              entry.deadline ? nairobiDateKey(entry.deadline) : null,
              today,
            )
            return <li className="space-y-2 py-3" key={entry.id}>
              <p className="font-medium">{entry.itemTitle} · {entry.categoryName}</p>
              {entry.productionTitle && <p className="text-sm text-slate-600">Linked production: {entry.productionTitle}</p>}
              <p className="text-sm text-slate-600">
                Status: {entry.status.toLowerCase()} · Deadline: {entry.deadline ? formatNairobiDate(entry.deadline) : 'Not set'}
                {overdue && <span className="ml-2 font-semibold text-red-700">Overdue</span>}
              </p>
              {entry.submittedAt && <p className="text-sm text-slate-600">Submitted {formatNairobiDate(entry.submittedAt)}</p>}
              {entry.confirmedAt && <p className="text-sm text-slate-600">Confirmed {formatNairobiDate(entry.confirmedAt)}</p>}
              {entry.notes && <p className="text-sm text-slate-600">{entry.notes}</p>}
              <FestivalEntryStatusForm festivalId={festivalId} entryId={entry.id} status={entry.status} />
            </li>
          })}
        </ul> : <p className="text-slate-600">No competition entries recorded yet.</p>}
      </div>
    </section>

    <section className="space-y-4">
      <header>
        <h2>Festival budget and actuals</h2>
        <p className="text-slate-600">Plan income and expenses, then explicitly link existing finance-ledger entries. Each ledger entry links to one budget item for its full amount; linking never creates or changes a transaction.</p>
        <p className="text-sm text-slate-600">The selector shows up to 100 of the most recent unlinked ledger entries.</p>
      </header>
      <FestivalBudgetItemForm festivalId={festivalId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-1">
          <h3>Planned income</h3>
          <p>{formatKES(planning.budgetSummary.INCOME.planned)}</p>
          <p className="text-sm text-slate-600">Actual linked: {formatKES(planning.budgetSummary.INCOME.actual)}</p>
        </div>
        <div className="card space-y-1">
          <h3>Planned expenses</h3>
          <p>{formatKES(planning.budgetSummary.EXPENSE.planned)}</p>
          <p className="text-sm text-slate-600">Actual linked: {formatKES(planning.budgetSummary.EXPENSE.actual)}</p>
        </div>
      </div>
      <div className="card space-y-3">
        <h3>Budget register</h3>
        {planning.budgetItems.length ? <ul className="divide-y divide-slate-100">
          {planning.budgetItems.map((item) => <li className="space-y-2 py-3" key={item.id}>
            <p className="font-medium">{item.type} · {item.category}</p>
            <p className="text-sm text-slate-600">
              Planned: {formatKES(item.plannedAmount)} · Actual linked: {formatKES(item.actualAmount)} · Approved: not tracked yet
            </p>
            {item.notes && <p className="text-sm text-slate-600">{item.notes}</p>}
            {item.links.length ? <ul className="ml-4 list-disc space-y-1 text-sm">
              {item.links.map((link) => <li className="flex flex-wrap items-center gap-2" key={link.id}>
                {link.financeEntry
                  ? `${formatNairobiDate(link.financeEntry.occurredAt)} · ${link.financeEntry.category} · ${formatKES(link.financeEntry.amount)} · ${link.financeEntry.description}`
                  : 'Linked ledger entry unavailable'}
                <FestivalFinanceUnlinkForm festivalId={festivalId} linkId={link.id} />
              </li>)}
            </ul> : <p className="text-sm text-slate-600">No actual ledger entries linked.</p>}
            <FestivalFinanceLinkForm
              festivalId={festivalId}
              budgetItem={item}
              entries={planning.unlinkedFinanceEntries}
            />
          </li>)}
        </ul> : <p className="text-slate-600">No festival budget items recorded yet.</p>}
        <p className="text-sm text-slate-600">Budget approvals and approved amounts will be added in Phase 5.</p>
      </div>
    </section>
  </div>
}
