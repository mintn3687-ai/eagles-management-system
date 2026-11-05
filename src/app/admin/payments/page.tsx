import Link from 'next/link'
import { nairobiDateKey, formatNairobiDate } from '@/lib/dates'
import { pageUser } from '@/lib/page-access'
import { formatKES } from '@/lib/money'
import { paymentListSchema } from '@/lib/validation/fees'
import { paymentWhere } from '@/lib/payments-query'
import { recordManualPaymentAction, reviewMemberPaymentAction, waiveFeeAction } from './actions'
import { adminReadService } from '@/modules/admin/read-service'

function buildQueryString(filters: Record<string, string | number | undefined>, page?: number, memberPage?: number) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'page' || key === 'memberPage') continue
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  if (page) params.set('page', String(page))
  const selectedMemberPage = memberPage ?? filters.memberPage
  if (selectedMemberPage) params.set('memberPage', String(selectedMemberPage))
  return params.toString()
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await pageUser('COMMITTEE')
  const params = await searchParams
  const parsed = paymentListSchema.safeParse(params)
  const error = typeof params.error === 'string' ? params.error : ''
  const success = typeof params.success === 'string' ? params.success : ''

  if (!parsed.success) {
    return <section className="card"><h1>Invalid filters</h1><Link className="btn-primary" href="/admin/payments">Reset the ledger</Link></section>
  }

  const filters = parsed.data
  const where = paymentWhere(filters)
  const [memberCount] = await adminReadService.paymentMemberOptions(filters.memberPage, 20)
  const memberPageCount = Math.max(1, Math.ceil(memberCount / 20))
  const memberPage = Math.min(filters.memberPage, memberPageCount)

  const [[payments, total, totalRegistration, totalSubscription, totalRetreatBonding, paymentGroups], [, members]] = await Promise.all([
    adminReadService.paymentLedger(where, filters.page, 20),
    adminReadService.paymentMemberOptions(memberPage, 20),
  ])

  const exportHref = `/admin/payments/export?${buildQueryString(filters)}`

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Payments</p>
        <h1>Payment ledger</h1>
      </div>
      <a className="btn-secondary" href={exportHref}>Export CSV</a>
    </div>

    {error && <p className="error">{error}</p>}
    {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}

    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      Live online M-Pesa checkout is not configured. Member-submitted references remain pending until an authorized committee member verifies them.
    </p>

    <section className="card grid gap-4 md:grid-cols-5">
      <div className="rounded-xl bg-rose-50 p-4">
        <p className="text-sm text-rose-800">Registration</p>
        <p className="mt-2 text-2xl font-semibold text-rose-900">{formatKES(totalRegistration._sum.amount ?? 0)}</p>
      </div>
      <div className="rounded-xl bg-amber-50 p-4">
        <p className="text-sm text-amber-800">Subscription</p>
        <p className="mt-2 text-2xl font-semibold text-amber-900">{formatKES(totalSubscription._sum.amount ?? 0)}</p>
      </div>
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">Retreat / bonding</p>
        <p className="mt-2 text-2xl font-semibold text-emerald-900">{formatKES(totalRetreatBonding._sum.amount ?? 0)}</p>
      </div>
      <div className="rounded-xl bg-slate-100 p-4 md:col-span-2">
        <p className="text-sm text-slate-700">Rows</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
      </div>
    </section>

    <section className="card">
      <h2>Payment counts by type and status</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100"><tr><th className="p-3">Fee type</th><th className="p-3">Status</th><th className="p-3">Count</th><th className="p-3">Amount</th></tr></thead>
          <tbody>{paymentGroups.map((group) => <tr className="border-t border-slate-200" key={`${group.type}-${group.status}`}>
            <td className="p-3">{group.type.replaceAll('_', ' ')}</td>
            <td className="p-3">{group.status}</td>
            <td className="p-3">{group._count._all}</td>
            <td className="p-3">{formatKES(group._sum.amount ?? 0)}</td>
          </tr>)}
          {!paymentGroups.length && <tr><td className="p-3 text-slate-600" colSpan={4}>No payments match these filters.</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="card">
      <h2>Record a manual payment</h2>
      <form action={recordManualPaymentAction} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="memberId">Member</label>
          <select className="input" id="memberId" name="memberId" required>
            <option value="">Choose member</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="type">Fee type</label>
          <select className="input" id="type" name="type" defaultValue="REGISTRATION" required>
            <option value="REGISTRATION">Registration</option>
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="RETREAT_BONDING">Retreat / bonding</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="method">Method</label>
          <select className="input" id="method" name="method" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <p className="rounded-lg bg-stone-50 p-3 text-sm text-slate-600 md:col-span-2">The payment uses the current fee amount for the selected type saved in Fee settings.</p>

        <div>
          <label className="label" htmlFor="date">Date</label>
          <input className="input" id="date" name="date" type="date" defaultValue={nairobiDateKey()} required />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="reference">Reference</label>
          <input className="input" id="reference" name="reference" type="text" maxLength={120} required placeholder="e.g. Cash receipt 204 or bank transfer reference" />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="reason">Reason</label>
          <textarea className="input" id="reason" name="reason" rows={3} minLength={3} maxLength={500} required placeholder="Required note explaining this manual payment record" />
        </div>

        <button className="btn-primary md:col-span-2" type="submit">Record payment</button>
      </form>
    </section>

    <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-slate-600">Member options: page {memberPage} of {memberPageCount} · {memberCount} members</p><nav className="flex gap-2" aria-label="Member option pages">{memberPage > 1 && <Link className="btn-secondary" href={`/admin/payments?${buildQueryString(filters, filters.page, memberPage - 1)}`}>Previous members</Link>}{memberPage < memberPageCount && <Link className="btn-secondary" href={`/admin/payments?${buildQueryString(filters, filters.page, memberPage + 1)}`}>Next members</Link>}</nav></div>

    <section className="card">
      <h2>Waive a fee</h2>
      <form action={waiveFeeAction} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="waiveMember">Member</label>
          <select className="input" id="waiveMember" name="memberId" required>
            <option value="">Choose member</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="waiverReason">Reason</label>
          <input className="input" id="waiverReason" name="reason" type="text" maxLength={500} required placeholder="Required reason for the waiver" />
        </div>
        <button className="btn-secondary" type="submit">Waive fee</button>
      </form>
    </section>

    <section className="card">
      <h2>Filters</h2>
      <form method="GET" className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="memberPage" value={memberPage} />
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select className="input" id="type" name="type" defaultValue={filters.type || ''}>
            <option value="">All</option>
            <option value="REGISTRATION">Registration</option>
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="RETREAT_BONDING">Retreat / bonding</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={filters.status || ''}>
            <option value="">All</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="method">Method</label>
          <select className="input" id="method" name="method" defaultValue={filters.method || ''}>
            <option value="">All</option>
            <option value="MPESA">M-Pesa</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">From</label>
          <input className="input" id="from" name="from" type="date" defaultValue={filters.from || ''} />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input className="input" id="to" name="to" type="date" defaultValue={filters.to || ''} />
        </div>
        <div>
          <label className="label" htmlFor="member">Member</label>
          <select className="input" id="member" name="member" defaultValue={filters.member || ''}>
            <option value="">All members</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
          </select>
        </div>
        <div className="md:col-span-3 lg:col-span-6 flex gap-3">
          <button className="btn-primary" type="submit">Apply filters</button>
          <Link className="btn-secondary" href="/admin/payments">Reset</Link>
        </div>
      </form>
    </section>

    <section className="card">
      <h2>Payments</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3">Type</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Method</th>
              <th className="p-3">Date</th>
              <th className="p-3">Reference</th>
              <th className="p-3">Source</th>
              <th className="p-3">Receipt</th>
              <th className="p-3">Review</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr className="border-t border-slate-200" key={payment.id}>
                <td className="p-3">{payment.member.fullName}</td>
                <td className="p-3">{payment.type.replaceAll('_', ' ')}</td>
                <td className="p-3">{formatKES(payment.amount)}</td>
                <td className="p-3">{payment.status}</td>
                <td className="p-3">{payment.method}</td>
                <td className="p-3">{formatNairobiDate(payment.paidAt ?? payment.createdAt)}</td>
                <td className="p-3">{payment.reference ?? '—'}</td>
                <td className="p-3">{payment.source === 'MEMBER_REPORTED' ? 'Member reported' : payment.source === 'PROVIDER_VERIFIED' ? 'Provider verified' : 'Admin recorded'}</td>
                <td className="p-3">{payment.status === 'SUCCESS' ? <Link className="underline" href={`/admin/payments/${payment.id}`}>View receipt</Link> : '—'}</td>
                <td className="p-3">
                  {payment.source === 'MEMBER_REPORTED' && payment.status === 'PENDING' ? <form action={reviewMemberPaymentAction} className="min-w-52 space-y-2">
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <label className="sr-only" htmlFor={`review-reason-${payment.id}`}>Review reason</label>
                    <input className="input" id={`review-reason-${payment.id}`} name="reason" minLength={3} maxLength={500} required placeholder="Verification note" />
                    <div className="flex gap-2">
                      <button className="btn-primary min-h-10 px-3 py-2 text-sm" name="decision" value="SUCCESS" type="submit">Verify</button>
                      <button className="btn-secondary min-h-10 px-3 py-2 text-sm" name="decision" value="FAILED" type="submit">Reject</button>
                      <button className="btn-secondary min-h-10 px-3 py-2 text-sm" name="decision" value="CANCELLED" type="submit">Cancel</button>
                    </div>
                  </form> : payment.source === 'MEMBER_REPORTED' ? payment.resultDesc ?? 'Reviewed' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!payments.length && <p className="mt-4 text-slate-600">No payments match these filters.</p>}
    </section>

    <nav className="flex gap-3" aria-label="Payment pages">
      {filters.page > 1 && <Link className="btn-secondary" href={`/admin/payments?${buildQueryString(filters, filters.page - 1)}`}>Previous</Link>}
      {filters.page * 20 < total && <Link className="btn-secondary" href={`/admin/payments?${buildQueryString(filters, filters.page + 1)}`}>Next</Link>}
    </nav>
  </div>
}
