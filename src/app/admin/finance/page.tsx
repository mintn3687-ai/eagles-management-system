import Link from 'next/link'
import { formatKES } from '@/lib/money'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { pagePermission } from '@/lib/page-access'
import {
  BudgetForm, CampaignForm, ContributionForm, FinanceEntryForm, GuestEntryForm,
  ReconciliationForms, ReimbursementReviewForms, TicketRefundForm, TicketSaleForm, TicketTypeForm,
} from '@/components/finance/finance-forms'
import {
  getFinanceDashboard, listAvailableTicketShows, listFinanceFormOptions,
} from '@/modules/finance/operations-service'

export default async function FinancePage() {
  await pagePermission('finance:manage')
  const [data, options, shows] = await Promise.all([
    getFinanceDashboard(), listFinanceFormOptions(), listAvailableTicketShows(),
  ])
  const activeCampaigns = data.campaigns.map((campaign) => ({
    id: campaign.id, title: campaign.title,
    raised: campaign.contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
  }))
  const ticketTypes = data.ticketTypes.map((type) => ({
    ...type,
    sold: type.sales.reduce((sum, sale) => sum + sale.quantity, 0),
    income: type.sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    refunded: type.sales.reduce((sum, sale) => sum + sale.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0), 0),
  }))
  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Finance operations</p>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1>Finance and ticketing</h1><p className="text-slate-600">Budgets, ledgers, reimbursements, fundraising, sales, and payment reconciliation.</p></div>
        <Link className="btn-secondary" href="/admin/finance/export">Export financial ledger CSV</Link></div>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">M-Pesa is simulated in this project unless a real integration is separately enabled. These screens record transactions; they do not initiate live payments.</p>
    </header>
    <form action="/admin/finance/export" method="get" className="card grid gap-3 sm:grid-cols-3 sm:items-end">
      <div><label className="label" htmlFor="report-season">Season report</label>
        <select className="input" id="report-season" name="seasonId" defaultValue=""><option value="">All seasons</option>{options.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select>
      </div>
      <div><label className="label" htmlFor="report-production">Production report</label>
        <select className="input" id="report-production" name="productionId" defaultValue=""><option value="">All productions</option>{options.productions.map((production) => <option key={production.id} value={production.id}>{production.title}</option>)}</select>
      </div>
      <button className="btn-secondary" type="submit">Download CSV</button>
    </form>

    <div className="grid gap-4 xl:grid-cols-2">
      <BudgetForm seasons={options.seasons} productions={options.productions} />
      <FinanceEntryForm seasons={options.seasons} productions={options.productions} today={nairobiDateKey()} />
    </div>
    <section className="card space-y-3">
      <h2>Budget register</h2>
      {data.budgets.length ? <ul className="divide-y divide-slate-100">{data.budgets.map((budget) => <li className="py-2" key={budget.id}>
        <span className="font-medium">{budget.category}</span> · {formatKES(budget.amount)} · {budget.production?.title ?? budget.season?.name ?? 'Unassigned'}
      </li>)}</ul> : <p className="text-slate-600">No budgets recorded.</p>}
    </section>
    <section className="card space-y-3">
      <h2>Income and expense register</h2>
      {data.entries.length ? <ul className="divide-y divide-slate-100">{data.entries.map((entry) => <li className="py-2" key={entry.id}>
        {formatNairobiDate(entry.occurredAt)} · <span className="font-medium">{entry.type}</span> · {entry.category} · {formatKES(entry.amount)} · {entry.description}
      </li>)}</ul> : <p className="text-slate-600">No additional finance entries recorded.</p>}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <CampaignForm seasons={options.seasons} productions={options.productions} />
      <ContributionForm seasons={options.seasons} productions={options.productions} campaigns={activeCampaigns} today={nairobiDateKey()} />
    </section>
    <section className="card space-y-3">
      <h2>Fundraising campaigns</h2>
      {activeCampaigns.length ? <ul className="divide-y divide-slate-100">{activeCampaigns.map((campaign) => <li className="py-2" key={campaign.id}>{campaign.title} · Raised {formatKES(campaign.raised)}</li>)}</ul> : <p className="text-slate-600">No active campaigns.</p>}
      <h3>Recent donations and sponsorships</h3>
      {data.contributions.length ? <ul className="divide-y divide-slate-100">{data.contributions.map((item) => <li className="py-2" key={item.id}>
        {formatNairobiDate(item.receivedAt)} · {item.type} · {item.contributor ?? 'Contributor not named'} · {formatKES(item.amount)}{item.campaign ? ` · ${item.campaign.title}` : ''}
      </li>)}</ul> : <p className="text-slate-600">No contributions recorded.</p>}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <TicketTypeForm shows={shows} />
      <TicketSaleForm ticketTypes={ticketTypes} />
      <TicketRefundForm ticketTypes={ticketTypes} />
      <GuestEntryForm shows={shows} ticketTypes={ticketTypes} />
    </section>
    <section className="card space-y-3">
      <h2>Box-office register</h2>
      {ticketTypes.length ? <ul className="divide-y divide-slate-100">{ticketTypes.map((ticket) => <li className="py-2" key={ticket.id}>
        {ticket.showDate.production.title} · {ticket.name}: {ticket.sold}{ticket.quantityAvailable === null ? '' : `/${ticket.quantityAvailable}`} sold · Gross {formatKES(ticket.income)} · Refunds {formatKES(ticket.refunded)}
      </li>)}</ul> : <p className="text-slate-600">No ticket types have been created.</p>}
      <h3>Guest list</h3>
      {data.guestEntries.length ? <ul className="divide-y divide-slate-100">{data.guestEntries.map((entry) => <li className="py-2" key={entry.id}>
        {entry.name} · {entry.showDate.production.title} · {formatNairobiDate(entry.showDate.startsAt, true)} · {entry.ticketSale?.reference ?? 'No linked sale'}
      </li>)}</ul> : <p className="text-slate-600">No guest entries recorded.</p>}
    </section>

    <section className="card space-y-3">
      <h2>Reimbursements awaiting action</h2>
      {data.reimbursements.length
        ? <ReimbursementReviewForms requests={data.reimbursements} />
        : <p className="text-slate-600">No requested or approved reimbursements.</p>}
    </section>
    <ReconciliationForms batches={data.batches} today={nairobiDateKey()} />
    <section className="card space-y-3">
      <h2>Reconciled statement batches</h2>
      {data.batches.some((batch) => batch.status === 'RECONCILED')
        ? <ul>{data.batches.filter((batch) => batch.status === 'RECONCILED').map((batch) => <li key={batch.id}>{batch.reference} · {batch.method} · {formatNairobiDate(batch.statementDate)}</li>)}</ul>
        : <p className="text-slate-600">No reconciliations completed.</p>}
    </section>
  </div>
}
