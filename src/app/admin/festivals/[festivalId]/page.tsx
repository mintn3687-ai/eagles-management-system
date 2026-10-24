import { notFound } from 'next/navigation'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import { pagePermission } from '@/lib/page-access'
import {
  FestivalApprovalDecisionForm,
  FestivalBudgetApprovalRequestForm,
  FestivalBudgetItemForm,
  FestivalCategoryForm,
  FestivalEntryForm,
  FestivalEntryStatusForm,
  FestivalFinanceLinkForm,
  FestivalFinanceUnlinkForm,
  FestivalInvitationForm,
  FestivalInvitationStatusForm,
  FestivalLogisticsItemForm,
  FestivalLogisticsStatusForm,
  FestivalPlanApprovalRequestForm,
  FestivalUpdateForm,
} from '@/components/festivals/festival-forms'
import { getFestival, getFestivalPlanning } from '@/modules/festivals/service'
import { isEntryOverdue, isFestivalLogisticsOverdue, isInvitationOverdue } from '@/modules/festivals/rules'

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
    <section className="card space-y-3">
      <h2>Festival plan approval</h2>
      <p className="text-sm text-slate-600">Any committee member may approve, including the person who submitted. Editing an approved plan returns it to Pending for approval again.</p>
      {planning.planApproval
        ? <div className="space-y-2">
          <p className="font-medium">Status: {planning.planApproval.status.toLowerCase()}</p>
          <p className="text-sm text-slate-600">Submitted by {planning.planApproval.submittedByName} · {formatNairobiDate(planning.planApproval.submittedAt, true)}</p>
          {planning.planApproval.decidedAt && <p className="text-sm text-slate-600">
            {planning.planApproval.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {planning.planApproval.decidedByName} · {formatNairobiDate(planning.planApproval.decidedAt, true)}
          </p>}
          {planning.planApproval.decisionReason && <p className="text-sm text-slate-600">Reason: {planning.planApproval.decisionReason}</p>}
          {planning.planApproval.status === 'PENDING' && <FestivalApprovalDecisionForm approval={planning.planApproval} />}
          {planning.planApproval.status === 'REJECTED' && <FestivalPlanApprovalRequestForm festivalId={festivalId} />}
        </div>
        : <div>
          <p className="text-sm text-slate-600">This plan has not been submitted for approval.</p>
          <FestivalPlanApprovalRequestForm festivalId={festivalId} />
        </div>}
    </section>

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
          <p className="text-sm text-slate-600">Approved: {formatKES(planning.budgetSummary.INCOME.approved)}</p>
          <p className="text-sm text-slate-600">Actual linked: {formatKES(planning.budgetSummary.INCOME.actual)}</p>
        </div>
        <div className="card space-y-1">
          <h3>Planned expenses</h3>
          <p>{formatKES(planning.budgetSummary.EXPENSE.planned)}</p>
          <p className="text-sm text-slate-600">Approved: {formatKES(planning.budgetSummary.EXPENSE.approved)}</p>
          <p className="text-sm text-slate-600">Actual linked: {formatKES(planning.budgetSummary.EXPENSE.actual)}</p>
        </div>
      </div>
      <div className="card space-y-3">
        <h3>Budget register</h3>
        {planning.budgetItems.length ? <ul className="divide-y divide-slate-100">
          {planning.budgetItems.map((item) => <li className="space-y-2 py-3" key={item.id}>
            <p className="font-medium">{item.type} · {item.category}</p>
            <p className="text-sm text-slate-600">
              Planned: {formatKES(item.plannedAmount)} · Actual linked: {formatKES(item.actualAmount)} · Approved: {item.approval?.status === 'APPROVED' && item.approval.approvedAmount !== null ? formatKES(item.approval.approvedAmount) : 'Not approved'}
            </p>
            {item.approval && <div className="space-y-1 text-sm text-slate-600">
              <p>Approval status: {item.approval.status.toLowerCase()} · Submitted by {item.approval.submittedByName} · {formatNairobiDate(item.approval.submittedAt, true)}</p>
              {item.approval.decidedAt && <p>
                {item.approval.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {item.approval.decidedByName} · {formatNairobiDate(item.approval.decidedAt, true)}
              </p>}
              {item.approval.decisionReason && <p>Reason: {item.approval.decisionReason}</p>}
            </div>}
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
            <details>
              <summary className="cursor-pointer text-sm text-emerald-800">Edit budget item</summary>
              <div className="mt-2"><FestivalBudgetItemForm festivalId={festivalId} budgetItem={item} /></div>
            </details>
            {item.approval?.status === 'PENDING' && <FestivalApprovalDecisionForm approval={item.approval} />}
            {(!item.approval || item.approval.status === 'REJECTED') && <FestivalBudgetApprovalRequestForm festivalId={festivalId} budgetItemId={item.id} />}
          </li>)}
        </ul> : <p className="text-slate-600">No festival budget items recorded yet.</p>}
        <p className="text-sm text-slate-600">A reduced approved budget amount requires a reason. Editing an approved budget item automatically returns it to Pending.</p>
      </div>
    </section>

    <section className="space-y-4">
      <header>
        <h2>Festival travel and logistics</h2>
        <p className="text-slate-600">Coordinate transport, accommodation, meals, schedules, venue, contacts, equipment, costumes, props, and participants. Assign one responsible member and track due dates and completion.</p>
      </header>
      <FestivalLogisticsItemForm festivalId={festivalId} members={planning.logisticsAssigneeOptions} />
      <div className="card space-y-3">
        <h3>Logistics checklist</h3>
        {planning.logisticsItems.length ? <ul className="divide-y divide-slate-100">
          {planning.logisticsItems.map((item) => {
            const dueDate = item.dueAt ? nairobiDateKey(item.dueAt) : null
            const overdue = isFestivalLogisticsOverdue(item.status, dueDate, today)
            return <li className="space-y-2 py-3" key={item.id}>
              <p className="font-medium">{item.category.replaceAll('_', ' ').toLowerCase()} · {item.title}</p>
              <p className="text-sm text-slate-600">
                Status: {item.status.replaceAll('_', ' ').toLowerCase()} · Due: {item.dueAt ? formatNairobiDate(item.dueAt) : 'Not set'}
                {overdue && <span className="ml-2 font-semibold text-red-700">Overdue</span>}
              </p>
              {item.assignedMemberName && <p className="text-sm text-slate-600">Responsible member: {item.assignedMemberName}</p>}
              {item.description && <p className="text-sm text-slate-600">{item.description}</p>}
              {item.completedAt && <p className="text-sm text-slate-600">
                Completed {formatNairobiDate(item.completedAt, true)}{item.completedByName ? ` by ${item.completedByName}` : ''}
              </p>}
              <FestivalLogisticsStatusForm festivalId={festivalId} logisticsItemId={item.id} status={item.status} />
              <details>
                <summary className="cursor-pointer text-sm text-emerald-800">Edit logistics item</summary>
                <div className="mt-2">
                  <FestivalLogisticsItemForm festivalId={festivalId} members={planning.logisticsAssigneeOptions} item={item} />
                </div>
              </details>
            </li>
          })}
        </ul> : <p className="text-slate-600">No festival logistics items yet. Add tasks for travel, schedules, equipment, or participant coordination.</p>}
      </div>
    </section>
  </div>
}
