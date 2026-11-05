import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SubmitButton } from '@/components/submit-button'
import { formatNairobiDate } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import { pageUser } from '@/lib/page-access'
import { getCurrentFee, getMemberSubscriptionStatus } from '@/lib/fees'
import { listMemberPaymentHistory } from '@/modules/finance/service'
import { submitMemberPaymentAction } from './actions'

const paymentOptions = [
  { type: 'REGISTRATION', title: 'Registration fee', description: 'One-time fee for new members.' },
  { type: 'SUBSCRIPTION', title: 'Subscription fee', description: 'Recurring fee for active members.' },
  { type: 'RETREAT_BONDING', title: 'Retreat / bonding fee', description: 'Contribution for club retreat or bonding activities.' },
] as const

const statusClass: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-900',
  SUCCESS: 'bg-emerald-50 text-emerald-900',
  FAILED: 'bg-rose-50 text-rose-900',
  CANCELLED: 'bg-slate-100 text-slate-800',
}

export default async function MemberFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; success?: string | string[] }>
}) {
  const user = await pageUser('MEMBER')
  if (!user.member) redirect('/forbidden')
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : ''
  const success = typeof params.success === 'string' ? params.success : ''
  const member = user.member
  const [registration, subscription, retreatBonding, history, subscriptionStatus] = await Promise.all([
    getCurrentFee('REGISTRATION'),
    getCurrentFee('SUBSCRIPTION'),
    getCurrentFee('RETREAT_BONDING'),
    listMemberPaymentHistory(member.id),
    member.status === 'ACTIVE' ? getMemberSubscriptionStatus(member.id) : Promise.resolve(null),
  ])
  const fees = { REGISTRATION: registration, SUBSCRIPTION: subscription, RETREAT_BONDING: retreatBonding }
  const pendingTypes = new Set(history.filter((payment) => payment.status === 'PENDING').map((payment) => payment.type))
  const latestSubscription = history.find((payment) => payment.type === 'SUBSCRIPTION' && payment.status === 'SUCCESS')

  return <div className="space-y-6">
    <header>
      <Link className="inline-flex min-h-11 items-center underline" href="/member">← Member home</Link>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Payments</p>
      <h1>Member payments</h1>
      <p className="text-slate-600">View your fees, submit a payment reference for review, and check your payment history.</p>
    </header>

    {error && <p className="error" role="alert">{error}</p>}
    {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{success}</p>}

    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      This system does not initiate live M-Pesa payments. Pay through a club-approved channel first, then submit the receipt or transaction reference. A submission stays pending until the committee verifies it. Never enter your M-Pesa PIN here.
    </p>

    <section className="grid gap-4 xl:grid-cols-3" aria-label="Separate member payment options">
      {paymentOptions.map((option) => {
        const fee = fees[option.type]
        const isEligible = option.type === 'REGISTRATION'
          ? member.status === 'PENDING_REGISTRATION'
          : option.type === 'SUBSCRIPTION'
            ? member.status === 'ACTIVE' && subscriptionStatus !== 'PAID'
            : ['ACTIVE', 'PENDING_REGISTRATION'].includes(member.status)
        const hasPending = pendingTypes.has(option.type)
        return <article className="card space-y-4" key={option.type}>
          <div>
            <h2>{option.title}</h2>
            <p className="text-sm text-slate-600">{option.description}</p>
          </div>
          {fee
            ? <p className="rounded-lg bg-stone-50 p-3 text-lg font-semibold">{formatKES(fee.amount)}{option.type === 'SUBSCRIPTION' ? ` · ${fee.billingPeriod?.toLowerCase() ?? 'monthly'}` : ''}</p>
            : <p className="error">This fee has not been configured. Please contact the committee.</p>}

          {option.type === 'SUBSCRIPTION' && subscriptionStatus && (
            <div className="text-sm">
              <p>Subscription standing: <strong>{subscriptionStatus}</strong></p>
              {latestSubscription?.periodStart && latestSubscription.periodEnd && (
                <p className="mt-1 text-slate-600">Latest paid period: {formatNairobiDate(latestSubscription.periodStart)} – {formatNairobiDate(latestSubscription.periodEnd)}</p>
              )}
            </div>
          )}
          {hasPending && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">You already have a payment for this fee awaiting committee review.</p>}
          {!isEligible && <p className="text-sm text-slate-600">
            {option.type === 'REGISTRATION' ? 'Registration payment is available while your membership is pending registration.' :
              option.type === 'SUBSCRIPTION' ? 'Subscription payment is available to active members when a payment is due.' :
                'This payment is available to active or pending-registration members.'}
          </p>}

          {fee && isEligible && !hasPending && (
            <form action={submitMemberPaymentAction} className="space-y-3">
              <input type="hidden" name="type" value={option.type} />
              <div>
                <label className="label" htmlFor={`${option.type}-method`}>How did you pay?</label>
                <select className="input" id={`${option.type}-method`} name="method" defaultValue="MPESA">
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other approved method</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`${option.type}-reference`}>Receipt / transaction reference</label>
                <input className="input" id={`${option.type}-reference`} name="reference" minLength={3} maxLength={120} required />
              </div>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input className="mt-1 h-5 w-5 accent-emerald-800" type="checkbox" name="confirmPaid" required />
                <span>I have already paid this amount through an approved club payment channel.</span>
              </label>
              <SubmitButton pendingText="Submitting for review…">Submit payment reference</SubmitButton>
            </form>
          )}
        </article>
      })}
    </section>

    <section className="card">
      <h2>Your payment history</h2>
      {history.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-stone-100"><tr>
            <th className="p-3">Date</th><th className="p-3">Fee</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Method</th><th className="p-3">Reference / receipt</th><th className="p-3">Verification</th>
          </tr></thead>
          <tbody>{history.map((payment) => <tr className="border-t border-slate-200" key={payment.id}>
            <td className="p-3">{formatNairobiDate(payment.paidAt ?? payment.createdAt)}</td>
            <td className="p-3">{payment.type.replaceAll('_', ' ')}</td>
            <td className="p-3">{formatKES(payment.amount)}</td>
            <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[payment.status]}`}>{payment.status}</span></td>
            <td className="p-3">{payment.method}</td>
            <td className="p-3">{payment.reference ?? '—'}</td>
            <td className="p-3">{payment.source === 'MEMBER_REPORTED' ? 'Committee review' : payment.source === 'PROVIDER_VERIFIED' ? 'Provider verified' : 'Committee recorded'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-slate-600">No payments have been recorded for your account yet.</p>}
      {history.length === 100 && <p className="mt-3 text-sm text-slate-500">Showing your latest 100 payment records.</p>}
    </section>
  </div>
}
