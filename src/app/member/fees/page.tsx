import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { getCurrentFee, getMemberSubscriptionStatus, resolveMemberFeeType } from '@/lib/fees'
import { formatKES } from '@/lib/money'
import { formatNairobiDate } from '@/lib/dates'
import { SignOut } from '@/components/sign-out'

const statusStyle = {
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  DUE: 'border-amber-200 bg-amber-50 text-amber-900',
  OVERDUE: 'border-rose-200 bg-rose-50 text-rose-900',
}

export default async function MemberFeesPage() {
  const user = await pageUser('MEMBER')
  if (!user.member) redirect(user.role === 'MEMBER' ? '/forbidden' : '/admin')

  const type = resolveMemberFeeType(user.member.status)
  if (!type) {
    return <section className="card space-y-4"><h1>Contact the committee</h1><p>Your membership status does not currently have a fee due. Please contact the committee if you need help.</p><Link className="btn-secondary" href="/member">Member home</Link></section>
  }

  const fee = await getCurrentFee(type)
  if (type === 'REGISTRATION') {
    return <section className="card space-y-5 border-l-4 border-rose-500">
      <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-rose-700">Registration fee</p><h1>Complete your registration</h1></div>
      <p>This is a one-time fee for new members. Contact the committee to record a cash or other payment. Your member pages will be available once it is recorded.</p>
      {fee ? <p className="rounded-lg bg-rose-50 p-4 text-xl font-semibold text-rose-900">Amount due: {formatKES(fee.amount)}</p> : <p className="error">The registration fee has not been set yet. Please contact the committee.</p>}
      <SignOut />
    </section>
  }

  const [status, latest] = await Promise.all([
    getMemberSubscriptionStatus(user.member.id),
    prisma.payment.findFirst({
      where: { memberId: user.member.id, type: 'SUBSCRIPTION', status: 'SUCCESS' },
      orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      select: { periodStart: true, periodEnd: true },
    }),
  ])

  return <section className="card space-y-5 border-l-4 border-amber-500">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-700">Subscription fee</p><h1>Your subscription</h1></div>
    <p>Billing period: <strong>{fee?.billingPeriod?.toLowerCase() ?? 'monthly'}</strong></p>
    {fee ? <p className="rounded-lg bg-amber-50 p-4 text-xl font-semibold text-amber-950">Current fee: {formatKES(fee.amount)}</p> : <p className="error">The subscription fee has not been set yet. Please contact the committee.</p>}
    <div className={`rounded-lg border p-4 ${statusStyle[status]}`}><p className="text-sm font-medium">Payment status</p><p className="text-xl font-bold">{status}</p></div>
    {latest?.periodStart && latest.periodEnd && <p className="text-sm text-slate-600">Latest paid period: {formatNairobiDate(latest.periodStart)} – {formatNairobiDate(latest.periodEnd)}</p>}
    <p className="text-sm text-slate-600">To pay or ask about your subscription, contact the committee. Online M-Pesa payments are not available yet.</p>
    <Link className="btn-secondary" href="/member">Member home</Link>
  </section>
}
