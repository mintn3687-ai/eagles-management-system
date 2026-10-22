import { redirect } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { formatKES } from '@/lib/money'
import { formatNairobiDate } from '@/lib/dates'
import { ReimbursementRequestForm } from '@/components/finance/finance-forms'
import { getMemberReimbursements, listFinanceFormOptions } from '@/modules/finance/operations-service'

export default async function MemberReimbursementsPage() {
  const user = await pagePermission('reimbursements:request')
  if (!user.member) redirect('/forbidden')
  if (user.member.status === 'PENDING_REGISTRATION') redirect('/member/fees')
  if (user.member.status !== 'ACTIVE') redirect('/member')
  const [requests, options] = await Promise.all([
    getMemberReimbursements(user.member.id), listFinanceFormOptions(),
  ])
  return <div className="space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Finance</p><h1>My reimbursements</h1><p className="text-slate-600">Submit an expense request and follow its review status.</p></header>
    <ReimbursementRequestForm seasons={options.seasons} productions={options.productions} />
    <section className="card space-y-3"><h2>Request history</h2>
      {requests.length ? <ul className="divide-y divide-slate-100">{requests.map((request) => <li className="py-3" key={request.id}>
        <p className="font-medium">{formatKES(request.amount)} · {request.status.replaceAll('_', ' ')}</p>
        <p className="text-sm">{request.reason}</p>
        <p className="text-sm text-slate-600">{formatNairobiDate(request.createdAt)}{request.paymentReference ? ` · Payment reference ${request.paymentReference}` : ''}</p>
      </li>)}</ul> : <p className="text-slate-600">You have not submitted reimbursement requests.</p>}
    </section>
  </div>
}
