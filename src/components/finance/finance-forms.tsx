'use client'

import { useActionState, type ReactNode } from 'react'
import { SubmitButton } from '@/components/submit-button'
import {
  addGuestEntryAction, addStatementEntryAction, closeReconciliationAction, createBudgetAction,
  createCampaignAction, createTicketTypeAction, decideReimbursementAction,
  openReconciliationAction, payReimbursementAction, recordContributionAction,
  recordFinanceEntryAction, recordTicketSaleAction, refundTicketAction,
  requestReimbursementAction,
} from '@/modules/finance/operations-actions'
import type { FinanceActionState } from '@/modules/finance/operations-actions'

type FinanceAction = (state: FinanceActionState, form: FormData) => Promise<FinanceActionState>
type SeasonOption = { id: string; name: string; isCurrent: boolean }
type ProductionOption = { id: string; title: string }
type ShowOption = { id: string; startsAt: Date; venue: string; production: { title: string; seasonId: string | null } }

function Form({ action: serverAction, submit, children, className = 'card space-y-4' }: {
  action: FinanceAction; submit: string; children: ReactNode; className?: string
}) {
  const [state, action] = useActionState(serverAction, {})
  return <form action={action} className={className}>
    {children}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-800" role="status">{state.message}</p>}
    <SubmitButton>{submit}</SubmitButton>
  </form>
}

function ScopeSelect({ seasons, productions, prefix }: { seasons: SeasonOption[]; productions: ProductionOption[]; prefix: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><label className="label" htmlFor={`${prefix}-season`}>Season</label>
      <select className="input" id={`${prefix}-season`} name="seasonId" defaultValue=""><option value="">No season</option>
        {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.isCurrent ? ' (current)' : ''}</option>)}
      </select></div>
    <div><label className="label" htmlFor={`${prefix}-production`}>Production</label>
      <select className="input" id={`${prefix}-production`} name="productionId" defaultValue=""><option value="">No production</option>
        {productions.map((production) => <option key={production.id} value={production.id}>{production.title}</option>)}
      </select></div>
  </div>
}

export function BudgetForm({ seasons, productions }: { seasons: SeasonOption[]; productions: ProductionOption[] }) {
  return <Form action={createBudgetAction} submit="Save budget">
    <h2>Production and season budgets</h2>
    <ScopeSelect seasons={seasons} productions={productions} prefix="budget" />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="budget-category">Category</label><input className="input" id="budget-category" name="category" maxLength={80} required /></div>
      <div><label className="label" htmlFor="budget-amount">Budget (KES)</label><input className="input" id="budget-amount" name="amount" type="number" min="1" step="1" required /></div>
    </div>
    <div><label className="label" htmlFor="budget-notes">Notes</label><textarea className="input" id="budget-notes" name="notes" maxLength={1000} rows={2} /></div>
  </Form>
}

export function FinanceEntryForm({ seasons, productions, today }: {
  seasons: SeasonOption[]; productions: ProductionOption[]; today: string
}) {
  return <Form action={recordFinanceEntryAction} submit="Record entry">
    <h2>Income and expenses</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="entry-type">Type</label><select className="input" id="entry-type" name="type"><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select></div>
      <div><label className="label" htmlFor="entry-date">Date</label><input className="input" id="entry-date" name="date" type="date" defaultValue={today} required /></div>
      <div><label className="label" htmlFor="entry-category">Category</label><input className="input" id="entry-category" name="category" maxLength={80} required /></div>
      <div><label className="label" htmlFor="entry-amount">Amount (KES)</label><input className="input" id="entry-amount" name="amount" type="number" min="1" step="1" required /></div>
    </div>
    <div><label className="label" htmlFor="entry-description">Description</label><textarea className="input" id="entry-description" name="description" maxLength={500} required /></div>
    <div><label className="label" htmlFor="entry-reference">Receipt reference</label><input className="input" id="entry-reference" name="receiptReference" maxLength={120} /></div>
    <ScopeSelect seasons={seasons} productions={productions} prefix="entry" />
  </Form>
}

export function CampaignForm({ seasons, productions }: { seasons: SeasonOption[]; productions: ProductionOption[] }) {
  return <Form action={createCampaignAction} submit="Create campaign">
    <h2>Fundraising campaign</h2>
    <div><label className="label" htmlFor="campaign-title">Campaign title</label><input className="input" id="campaign-title" name="title" maxLength={120} required /></div>
    <div><label className="label" htmlFor="campaign-description">Description</label><textarea className="input" id="campaign-description" name="description" maxLength={1000} /></div>
    <div><label className="label" htmlFor="campaign-goal">Goal (KES)</label><input className="input" id="campaign-goal" name="goalAmount" type="number" min="1" step="1" required /></div>
    <ScopeSelect seasons={seasons} productions={productions} prefix="campaign" />
  </Form>
}

export function ContributionForm({ seasons, productions, campaigns, today }: {
  seasons: SeasonOption[]; productions: ProductionOption[]; campaigns: Array<{ id: string; title: string }>; today: string
}) {
  return <Form action={recordContributionAction} submit="Record contribution">
    <h2>Donations and sponsors</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="contribution-type">Contribution type</label><select className="input" id="contribution-type" name="type"><option value="DONATION">Donation</option><option value="SPONSORSHIP">Sponsorship</option></select></div>
      <div><label className="label" htmlFor="contributor">Donor or sponsor (optional)</label><input className="input" id="contributor" name="contributor" maxLength={160} /></div>
      <div><label className="label" htmlFor="contribution-amount">Amount (KES)</label><input className="input" id="contribution-amount" name="amount" type="number" min="1" step="1" required /></div>
      <div><label className="label" htmlFor="contribution-date">Date</label><input className="input" id="contribution-date" name="date" type="date" defaultValue={today} required /></div>
      <div><label className="label" htmlFor="contribution-method">Method</label><select className="input" id="contribution-method" name="method"><option value="MPESA">M-Pesa</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></div>
      <div><label className="label" htmlFor="contribution-reference">Reference</label><input className="input" id="contribution-reference" name="reference" maxLength={120} /></div>
    </div>
    <div><label className="label" htmlFor="contribution-campaign">Campaign</label><select className="input" id="contribution-campaign" name="campaignId" defaultValue=""><option value="">No campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></div>
    <ScopeSelect seasons={seasons} productions={productions} prefix="contribution" />
  </Form>
}

export function TicketTypeForm({ shows }: { shows: ShowOption[] }) {
  return <Form action={createTicketTypeAction} submit="Create ticket type">
    <h2>Ticket type</h2>
    <div><label className="label" htmlFor="ticket-show">Show</label><select className="input" id="ticket-show" name="showDateId" required defaultValue=""><option value="" disabled>Select show</option>
      {shows.map((show) => <option key={show.id} value={show.id}>{show.production.title} · {show.startsAt.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })} · {show.venue}</option>)}
    </select></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="label" htmlFor="ticket-name">Name</label><input className="input" id="ticket-name" name="name" maxLength={80} required /></div>
      <div><label className="label" htmlFor="ticket-price">Price (KES)</label><input className="input" id="ticket-price" name="price" type="number" min="0" step="1" required /></div>
      <div><label className="label" htmlFor="ticket-capacity">Capacity (optional)</label><input className="input" id="ticket-capacity" name="quantityAvailable" type="number" min="1" step="1" /></div>
    </div>
  </Form>
}

type TicketOption = { id: string; name: string; price: number; sales: Array<{ id: string; totalAmount: number; buyerName: string | null; reference: string | null; refunds: Array<{ amount: number }> }> }

export function TicketSaleForm({ ticketTypes }: { ticketTypes: TicketOption[] }) {
  return <Form action={recordTicketSaleAction} submit="Record ticket sale">
    <h2>Ticket sale</h2>
    <div><label className="label" htmlFor="sale-ticket-type">Ticket type</label><select className="input" id="sale-ticket-type" name="ticketTypeId" required defaultValue=""><option value="" disabled>Select ticket type</option>{ticketTypes.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.name} · KES {ticket.price}</option>)}</select></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="sale-quantity">Quantity</label><input className="input" id="sale-quantity" name="quantity" type="number" min="1" max="1000" step="1" required /></div>
      <div><label className="label" htmlFor="sale-buyer">Buyer (optional)</label><input className="input" id="sale-buyer" name="buyerName" maxLength={160} /></div>
      <div><label className="label" htmlFor="sale-method">Method</label><select className="input" id="sale-method" name="method"><option value="MPESA">M-Pesa</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></div>
      <div><label className="label" htmlFor="sale-reference">Reference</label><input className="input" id="sale-reference" name="reference" maxLength={120} /></div>
    </div>
  </Form>
}

export function TicketRefundForm({ ticketTypes }: { ticketTypes: TicketOption[] }) {
  const sales = ticketTypes.flatMap((ticket) => ticket.sales.map((sale) => ({
    ...sale, ticketName: ticket.name, refundable: sale.totalAmount - sale.refunds.reduce((sum, refund) => sum + refund.amount, 0),
  }))).filter((sale) => sale.refundable > 0)
  return <Form action={refundTicketAction} submit="Record refund">
    <h2>Ticket refund</h2>
    <div><label className="label" htmlFor="refund-sale">Sale</label><select className="input" id="refund-sale" name="ticketSaleId" required defaultValue=""><option value="" disabled>Select sale</option>
      {sales.map((sale) => <option key={sale.id} value={sale.id}>{sale.ticketName} · {sale.buyerName || sale.reference || sale.id} · refundable KES {sale.refundable}</option>)}
    </select></div>
    <div><label className="label" htmlFor="refund-amount">Refund amount (KES)</label><input className="input" id="refund-amount" name="amount" type="number" min="1" step="1" required /></div>
    <div><label className="label" htmlFor="refund-reason">Reason</label><textarea className="input" id="refund-reason" name="reason" maxLength={500} required /></div>
  </Form>
}

export function GuestEntryForm({ shows, ticketTypes }: { shows: ShowOption[]; ticketTypes: TicketOption[] }) {
  const sales = ticketTypes.flatMap((ticket) => ticket.sales.map((sale) => ({ ...sale, ticketName: ticket.name })))
  return <Form action={addGuestEntryAction} submit="Add guest">
    <h2>Guest list entry</h2>
    <div><label className="label" htmlFor="guest-show">Show</label><select className="input" id="guest-show" name="showDateId" required defaultValue=""><option value="" disabled>Select show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.production.title} · {show.venue}</option>)}</select></div>
    <div><label className="label" htmlFor="guest-name">Guest name</label><input className="input" id="guest-name" name="name" maxLength={160} required /></div>
    <div><label className="label" htmlFor="guest-sale">Ticket sale (optional)</label><select className="input" id="guest-sale" name="ticketSaleId" defaultValue=""><option value="">No linked sale</option>{sales.map((sale) => <option key={sale.id} value={sale.id}>{sale.ticketName} · {sale.buyerName || sale.reference || sale.id}</option>)}</select></div>
    <div><label className="label" htmlFor="guest-note">Note</label><input className="input" id="guest-note" name="note" maxLength={300} /></div>
  </Form>
}

export function ReconciliationForms({ batches, today }: {
  batches: Array<{ id: string; reference: string; status: string; entries: Array<{ id: string; statementReference: string; amount: number; paymentId: string | null; ticketSaleId: string | null }> }>
  today: string
}) {
  const open = batches.filter((batch) => batch.status === 'OPEN')
  return <section className="space-y-4">
    <Form action={openReconciliationAction} submit="Start reconciliation">
      <h2>Payment reconciliation</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="statement-method">Statement method</label><select className="input" id="statement-method" name="method"><option value="MPESA">M-Pesa</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></div>
        <div><label className="label" htmlFor="statement-date">Statement date</label><input className="input" id="statement-date" name="statementDate" type="date" defaultValue={today} required /></div>
        <div><label className="label" htmlFor="statement-batch-reference">Statement reference</label><input className="input" id="statement-batch-reference" name="reference" maxLength={120} required /></div>
      </div>
    </Form>
    {open.map((batch) => <article className="card space-y-3" key={batch.id}>
      <h3>{batch.reference} · {batch.entries.filter((entry) => entry.paymentId || entry.ticketSaleId).length}/{batch.entries.length} matched</h3>
      <Form action={addStatementEntryAction} submit="Add and match statement entry">
        <input type="hidden" name="batchId" value={batch.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor={`stmt-ref-${batch.id}`}>Transaction reference</label><input className="input" id={`stmt-ref-${batch.id}`} name="statementReference" maxLength={120} required /></div>
          <div><label className="label" htmlFor={`stmt-amount-${batch.id}`}>Amount (KES)</label><input className="input" id={`stmt-amount-${batch.id}`} name="amount" type="number" min="1" step="1" required /></div>
          <div><label className="label" htmlFor={`stmt-note-${batch.id}`}>Note</label><input className="input" id={`stmt-note-${batch.id}`} name="notes" maxLength={300} /></div>
        </div>
      </Form>
      <ul className="text-sm">{batch.entries.map((entry) => <li key={entry.id}>{entry.statementReference} · KES {entry.amount} · {entry.paymentId || entry.ticketSaleId ? 'Matched' : 'Unmatched'}</li>)}</ul>
      <Form action={closeReconciliationAction} submit="Complete reconciliation" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="batchId" value={batch.id} />
      </Form>
    </article>)}
  </section>
}

export function ReimbursementRequestForm({ seasons, productions }: { seasons: SeasonOption[]; productions: ProductionOption[] }) {
  return <Form action={requestReimbursementAction} submit="Submit reimbursement request">
    <h2>Request reimbursement</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="reimbursement-amount">Amount (KES)</label><input className="input" id="reimbursement-amount" name="amount" type="number" min="1" step="1" required /></div>
      <div><label className="label" htmlFor="reimbursement-receipt">Receipt reference</label><input className="input" id="reimbursement-receipt" name="receiptReference" maxLength={120} /></div>
    </div>
    <div><label className="label" htmlFor="reimbursement-reason">Reason</label><textarea className="input" id="reimbursement-reason" name="reason" minLength={5} maxLength={1000} required /></div>
    <ScopeSelect seasons={seasons} productions={productions} prefix="reimbursement" />
  </Form>
}

export function ReimbursementReviewForms({ requests }: {
  requests: Array<{ id: string; amount: number; status: string; reason: string; requestedBy: { fullName: string } }>
}) {
  return <ul className="space-y-3">{requests.map((request) => <li className="rounded-lg border border-slate-200 p-4" key={request.id}>
    <p className="font-medium">{request.requestedBy.fullName} · KES {request.amount} · {request.status.toLowerCase()}</p><p className="text-sm">{request.reason}</p>
    {request.status === 'REQUESTED'
      ? <div className="mt-3 flex flex-wrap gap-3">
        {(['APPROVED', 'REJECTED'] as const).map((decision) => <Form key={decision} action={decideReimbursementAction} submit={decision} className="flex items-end gap-2">
          <input type="hidden" name="reimbursementId" value={request.id} /><input type="hidden" name="decision" value={decision} />
        </Form>)}
      </div>
      : <Form action={payReimbursementAction} submit="Mark paid" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="reimbursementId" value={request.id} />
        <div><label className="label" htmlFor={`reimbursement-pay-ref-${request.id}`}>Payment reference</label><input className="input" id={`reimbursement-pay-ref-${request.id}`} name="paymentReference" maxLength={120} required /></div>
      </Form>}
  </li>)}</ul>
}
