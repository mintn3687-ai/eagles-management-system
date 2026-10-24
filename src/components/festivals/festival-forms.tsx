'use client'

import { useActionState, type ReactNode } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { nairobiDateKey } from '@/lib/dates'
import {
  createFestivalCategoryAction,
  createFestivalEntryAction,
  createFestivalInvitationAction,
  createFestivalBudgetItemAction,
  createFestivalLogisticsItemAction,
  decideFestivalApprovalAction,
  createFestivalAction,
  linkFestivalFinanceEntryAction,
  unlinkFestivalFinanceEntryAction,
  submitFestivalPlanApprovalAction,
  submitFestivalBudgetApprovalAction,
  updateFestivalEntryStatusAction,
  updateFestivalInvitationStatusAction,
  updateFestivalCategoryAction,
  updateFestivalBudgetItemAction,
  updateFestivalLogisticsItemAction,
  updateFestivalLogisticsStatusAction,
  updateFestivalAction,
} from '@/modules/festivals/actions'
import type { FestivalActionState } from '@/modules/festivals/actions'
import { formatKES } from '@/lib/money'
import { formatNairobiDate } from '@/lib/dates'
import { festivalLogisticsCategories } from '@/modules/festivals/rules'

type FestivalFormAction = (state: FestivalActionState, form: FormData) => Promise<FestivalActionState>
type FestivalRecord = {
  id: string
  name: string
  year: number
  organizer: string | null
  venue: string | null
  startDate: Date | null
  endDate: Date | null
  status: string
  notes: string | null
}
type FestivalCategoryOption = { id: string; name: string; defaultDeadline: Date | null }
type ProductionOption = { id: string; title: string }
type BudgetItemOption = {
  id: string
  type: string
  category: string
  plannedAmount: number
  notes: string | null
}
type LogisticsItemOption = {
  id: string
  category: string
  title: string
  description: string | null
  dueAt: Date | null
  assignedMemberId: string | null
}
type LogisticsAssigneeOption = { id: string; fullName: string }
type FinanceEntryOption = {
  id: string
  type: string
  amount: number
  category: string
  description: string
  occurredAt: Date
}

function Form({ action: serverAction, submit, children, className = 'card space-y-4' }: {
  action: FestivalFormAction
  submit: string
  children: ReactNode
  className?: string
}) {
  const [state, action] = useActionState(serverAction, {})
  return <form action={action} className={className}>
    {children}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-800" role="status">{state.message}</p>}
    <SubmitButton>{submit}</SubmitButton>
  </form>
}

function FestivalFields({ festival, today }: { festival?: FestivalRecord; today: string }) {
  const prefix = festival ? `festival-${festival.id}` : 'new-festival'
  return <>
    <div><label className="label" htmlFor={`${prefix}-name`}>Festival name</label>
      <input className="input" id={`${prefix}-name`} name="name" maxLength={160} required defaultValue={festival?.name ?? ''} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-year`}>Year</label>
        <input className="input" id={`${prefix}-year`} name="year" type="number" min="1900" max="2200" step="1" required defaultValue={festival?.year ?? Number(today.slice(0, 4))} />
      </div>
      <div><label className="label" htmlFor={`${prefix}-organizer`}>University / organizer</label>
        <input className="input" id={`${prefix}-organizer`} name="organizer" maxLength={160} defaultValue={festival?.organizer ?? ''} />
      </div>
    </div>
    <div><label className="label" htmlFor={`${prefix}-venue`}>Venue</label>
      <input className="input" id={`${prefix}-venue`} name="venue" maxLength={160} defaultValue={festival?.venue ?? ''} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-start`}>Start date</label>
        <input className="input" id={`${prefix}-start`} name="startDate" type="date" defaultValue={festival?.startDate ? nairobiDateKey(festival.startDate) : today} />
      </div>
      <div><label className="label" htmlFor={`${prefix}-end`}>End date</label>
        <input className="input" id={`${prefix}-end`} name="endDate" type="date" defaultValue={festival?.endDate ? nairobiDateKey(festival.endDate) : ''} />
      </div>
    </div>
    {festival && <div><label className="label" htmlFor={`${prefix}-status`}>Status</label>
      <select className="input" id={`${prefix}-status`} name="status" defaultValue={festival.status}>
        <option value="DRAFT">Draft</option>
        <option value="PLANNING">Planning</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
    </div>}
    <div><label className="label" htmlFor={`${prefix}-notes`}>Notes</label>
      <textarea className="input" id={`${prefix}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={festival?.notes ?? ''} />
    </div>
  </>
}

export function FestivalCreateForm({ today }: { today: string }) {
  return <Form action={createFestivalAction} submit="Create festival">
    <h2>Plan a festival</h2>
    <FestivalFields today={today} />
  </Form>
}

export function FestivalUpdateForm({ festival, today }: { festival: FestivalRecord; today: string }) {
  return <Form action={updateFestivalAction} submit="Save festival details">
    <input type="hidden" name="festivalId" value={festival.id} />
    <h2>Festival details</h2>
    <p className="text-sm text-slate-600">Changes to an approved plan return it to Pending for approval again.</p>
    <FestivalFields festival={festival} today={today} />
  </Form>
}

export function FestivalInvitationForm({ festivalId, today }: { festivalId: string; today: string }) {
  return <Form action={createFestivalInvitationAction} submit="Record invitation">
    <input type="hidden" name="festivalId" value={festivalId} />
    <h3>Record an invitation</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="invitation-received">Received on</label>
        <input className="input" id="invitation-received" name="receivedAt" type="date" required defaultValue={today} />
      </div>
      <div><label className="label" htmlFor="invitation-response-deadline">Response deadline</label>
        <input className="input" id="invitation-response-deadline" name="responseDeadline" type="date" />
      </div>
    </div>
    <div><label className="label" htmlFor="invitation-notes">Notes</label>
      <textarea className="input" id="invitation-notes" name="notes" maxLength={2000} rows={2} />
    </div>
  </Form>
}

export function FestivalInvitationStatusForm({ festivalId, invitationId }: { festivalId: string; invitationId: string }) {
  return <Form action={updateFestivalInvitationStatusAction} submit="Save response">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="invitationId" value={invitationId} />
    <label className="sr-only" htmlFor={`invitation-status-${invitationId}`}>Invitation response</label>
    <select className="input" id={`invitation-status-${invitationId}`} name="status" defaultValue="ACCEPTED">
      <option value="ACCEPTED">Accept invitation</option>
      <option value="DECLINED">Decline invitation</option>
    </select>
  </Form>
}

export function FestivalCategoryForm({ festivalId, category }: {
  festivalId: string
  category?: FestivalCategoryOption
}) {
  const action = category ? updateFestivalCategoryAction : createFestivalCategoryAction
  return <Form action={action} submit={category ? 'Save category' : 'Add category'}>
    <input type="hidden" name="festivalId" value={festivalId} />
    {category && <input type="hidden" name="categoryId" value={category.id} />}
    <h3>{category ? `Edit ${category.name}` : 'Configure an entry category'}</h3>
    <div><label className="label" htmlFor={`festival-category-name-${category?.id ?? 'new'}`}>Category or class</label>
      <input className="input" id={`festival-category-name-${category?.id ?? 'new'}`} name="name" maxLength={120} required defaultValue={category?.name ?? ''} />
    </div>
    <div><label className="label" htmlFor={`festival-category-deadline-${category?.id ?? 'new'}`}>Default submission deadline</label>
      <input className="input" id={`festival-category-deadline-${category?.id ?? 'new'}`} name="defaultDeadline" type="date" defaultValue={category?.defaultDeadline ? nairobiDateKey(category.defaultDeadline) : ''} />
    </div>
    <p className="text-sm text-slate-600">Use the category names and dates provided by the festival organizer.</p>
  </Form>
}

export function FestivalEntryForm({ festivalId, categories, productions }: {
  festivalId: string
  categories: FestivalCategoryOption[]
  productions: ProductionOption[]
}) {
  return <Form action={createFestivalEntryAction} submit="Create competition entry">
    <input type="hidden" name="festivalId" value={festivalId} />
    <h3>Competition entry</h3>
    <div><label className="label" htmlFor="festival-entry-title">Production or performance item</label>
      <input className="input" id="festival-entry-title" name="itemTitle" maxLength={160} required />
    </div>
    <div><label className="label" htmlFor="festival-entry-category">Festival category or class</label>
      <select className="input" id="festival-entry-category" name="categoryId" required defaultValue="">
        <option value="" disabled>Select a configured category</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </div>
    <div><label className="label" htmlFor="festival-entry-production">Link an existing production (optional)</label>
      <select className="input" id="festival-entry-production" name="productionId" defaultValue="">
        <option value="">Not linked to a production</option>
        {productions.map((production) => <option key={production.id} value={production.id}>{production.title}</option>)}
      </select>
    </div>
    <div><label className="label" htmlFor="festival-entry-deadline">Submission deadline (optional override)</label>
      <input className="input" id="festival-entry-deadline" name="deadline" type="date" />
      <p className="mt-1 text-sm text-slate-600">Leave blank to use the category’s default deadline.</p>
    </div>
    <div><label className="label" htmlFor="festival-entry-notes">Notes</label>
      <textarea className="input" id="festival-entry-notes" name="notes" maxLength={2000} rows={2} />
    </div>
  </Form>
}

export function FestivalEntryStatusForm({ festivalId, entryId, status }: {
  festivalId: string
  entryId: string
  status: string
}) {
  const nextStatuses = status === 'PENDING'
    ? [{ value: 'PREPARING', label: 'Preparing' }, { value: 'SUBMITTED', label: 'Submitted' }]
    : status === 'PREPARING'
      ? [{ value: 'SUBMITTED', label: 'Submitted' }]
      : status === 'SUBMITTED'
        ? [{ value: 'CONFIRMED', label: 'Confirmed' }, { value: 'REJECTED', label: 'Not accepted' }]
        : []
  if (!nextStatuses.length) return <span className="text-sm text-slate-600">No further status changes</span>
  return <Form action={updateFestivalEntryStatusAction} submit="Update entry status">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="entryId" value={entryId} />
    <label className="sr-only" htmlFor={`entry-status-${entryId}`}>Next entry status</label>
    <select className="input" id={`entry-status-${entryId}`} name="status" defaultValue={nextStatuses[0].value}>
      {nextStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </Form>
}

export function FestivalLogisticsItemForm({ festivalId, members, item }: {
  festivalId: string
  members: LogisticsAssigneeOption[]
  item?: LogisticsItemOption
}) {
  const action = item ? updateFestivalLogisticsItemAction : createFestivalLogisticsItemAction
  const prefix = item ? `festival-logistics-${item.id}` : 'festival-logistics-new'
  return <Form action={action} submit={item ? 'Save logistics item' : 'Add logistics item'}>
    <input type="hidden" name="festivalId" value={festivalId} />
    {item && <input type="hidden" name="logisticsItemId" value={item.id} />}
    <h3>{item ? `Edit ${item.title}` : 'Add a logistics item'}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-category`}>Area</label>
        <select className="input" id={`${prefix}-category`} name="category" defaultValue={item?.category ?? 'TRANSPORT'}>
          {festivalLogisticsCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ').toLowerCase()}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor={`${prefix}-title`}>Item</label>
        <input className="input" id={`${prefix}-title`} name="title" maxLength={160} required defaultValue={item?.title ?? ''} placeholder="e.g. Confirm bus departure time" />
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-due`}>Due date</label>
        <input className="input" id={`${prefix}-due`} name="dueAt" type="date" defaultValue={item?.dueAt ? nairobiDateKey(item.dueAt) : ''} />
      </div>
      <div><label className="label" htmlFor={`${prefix}-assignee`}>Responsible member (optional)</label>
        <select className="input" id={`${prefix}-assignee`} name="assignedMemberId" defaultValue={item?.assignedMemberId ?? ''}>
          <option value="">Unassigned</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
        </select>
      </div>
    </div>
    <div><label className="label" htmlFor={`${prefix}-description`}>Details</label>
      <textarea className="input" id={`${prefix}-description`} name="description" maxLength={2000} rows={2} defaultValue={item?.description ?? ''} />
      <p className="mt-1 text-sm text-slate-600">Avoid recording personal details that are not needed for festival coordination.</p>
    </div>
  </Form>
}

export function FestivalLogisticsStatusForm({ festivalId, logisticsItemId, status }: {
  festivalId: string
  logisticsItemId: string
  status: string
}) {
  return <Form action={updateFestivalLogisticsStatusAction} submit="Update logistics status" className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="logisticsItemId" value={logisticsItemId} />
    <div className="min-w-44">
      <label className="label" htmlFor={`festival-logistics-status-${logisticsItemId}`}>Status</label>
      <select className="input" id={`festival-logistics-status-${logisticsItemId}`} name="status" defaultValue={status}>
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="COMPLETED">Completed</option>
      </select>
    </div>
  </Form>
}

export function FestivalBudgetItemForm({ festivalId, budgetItem }: {
  festivalId: string
  budgetItem?: BudgetItemOption
}) {
  const action = budgetItem ? updateFestivalBudgetItemAction : createFestivalBudgetItemAction
  const prefix = budgetItem ? `budget-item-${budgetItem.id}` : 'festival-budget-new'
  return <Form action={action} submit={budgetItem ? 'Save budget item' : 'Add budget item'}>
    <input type="hidden" name="festivalId" value={festivalId} />
    {budgetItem && <input type="hidden" name="budgetItemId" value={budgetItem.id} />}
    <h3>{budgetItem ? `Edit ${budgetItem.category}` : 'Plan income or expense'}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-type`}>Budget type</label>
        <select className="input" id={`${prefix}-type`} name="type" defaultValue={budgetItem?.type ?? 'EXPENSE'}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
      </div>
      <div><label className="label" htmlFor={`${prefix}-category`}>Category</label>
        <input className="input" id={`${prefix}-category`} name="category" maxLength={120} placeholder="Transport, registration, meals…" required defaultValue={budgetItem?.category ?? ''} />
      </div>
    </div>
    <div><label className="label" htmlFor={`${prefix}-planned`}>Planned amount (KES)</label>
      <input className="input" id={`${prefix}-planned`} name="plannedAmount" type="number" min="1" max="2147483647" step="1" required defaultValue={budgetItem?.plannedAmount} />
    </div>
    <div><label className="label" htmlFor={`${prefix}-notes`}>Notes</label>
      <textarea className="input" id={`${prefix}-notes`} name="notes" maxLength={1000} rows={2} defaultValue={budgetItem?.notes ?? ''} />
    </div>
  </Form>
}

export function FestivalFinanceLinkForm({ festivalId, budgetItem, entries }: {
  festivalId: string
  budgetItem: BudgetItemOption
  entries: FinanceEntryOption[]
}) {
  const matches = entries.filter((entry) => entry.type === budgetItem.type)
  if (!matches.length) return <p className="text-sm text-slate-600">No unlinked {budgetItem.type.toLowerCase()} ledger entries are available.</p>
  return <Form action={linkFestivalFinanceEntryAction} submit="Link existing ledger entry" className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="budgetItemId" value={budgetItem.id} />
    <div className="min-w-64 flex-1">
      <label className="label" htmlFor={`finance-entry-${budgetItem.id}`}>Existing {budgetItem.type.toLowerCase()} entry</label>
      <select className="input" id={`finance-entry-${budgetItem.id}`} name="financeEntryId" required defaultValue="">
        <option value="" disabled>Select a ledger entry</option>
        {matches.map((entry) => <option key={entry.id} value={entry.id}>
          {formatNairobiDate(entry.occurredAt)} · {entry.category} · {formatKES(entry.amount)} · {entry.description}
        </option>)}
      </select>
    </div>
  </Form>
}

export function FestivalFinanceUnlinkForm({ festivalId, linkId }: { festivalId: string; linkId: string }) {
  return <Form action={unlinkFestivalFinanceEntryAction} submit="Remove link" className="flex items-center gap-2">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="linkId" value={linkId} />
  </Form>
}

export function FestivalPlanApprovalRequestForm({ festivalId }: { festivalId: string }) {
  return <Form action={submitFestivalPlanApprovalAction} submit="Submit plan for approval" className="flex items-center gap-2">
    <input type="hidden" name="festivalId" value={festivalId} />
  </Form>
}

export function FestivalBudgetApprovalRequestForm({ festivalId, budgetItemId }: {
  festivalId: string
  budgetItemId: string
}) {
  return <Form action={submitFestivalBudgetApprovalAction} submit="Submit budget for approval" className="flex items-center gap-2">
    <input type="hidden" name="festivalId" value={festivalId} />
    <input type="hidden" name="budgetItemId" value={budgetItemId} />
  </Form>
}

export function FestivalApprovalDecisionForm({ approval }: {
  approval: {
    id: string
    type: string
    requestedAmount: number | null
  }
}) {
  return <Form action={decideFestivalApprovalAction} submit="Save decision">
    <input type="hidden" name="approvalId" value={approval.id} />
    <div><label className="label" htmlFor={`approval-decision-${approval.id}`}>Decision</label>
      <select className="input" id={`approval-decision-${approval.id}`} name="decision" defaultValue="APPROVED">
        <option value="APPROVED">Approve</option>
        <option value="REJECTED">Reject</option>
      </select>
    </div>
    {approval.type === 'BUDGET' && <div>
      <label className="label" htmlFor={`approval-amount-${approval.id}`}>Approved amount (KES)</label>
      <input className="input" id={`approval-amount-${approval.id}`} name="approvedAmount" type="number" min="1" max={approval.requestedAmount ?? undefined} step="1" required defaultValue={approval.requestedAmount ?? ''} />
      <p className="mt-1 text-sm text-slate-600">A reduced amount requires a reason.</p>
    </div>}
    <div><label className="label" htmlFor={`approval-reason-${approval.id}`}>Decision reason</label>
      <textarea className="input" id={`approval-reason-${approval.id}`} name="reason" maxLength={1000} rows={2} />
      <p className="mt-1 text-sm text-slate-600">Required when rejecting or approving less than requested.</p>
    </div>
  </Form>
}
