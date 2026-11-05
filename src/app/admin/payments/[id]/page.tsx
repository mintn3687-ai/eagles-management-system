import Link from 'next/link'
import { formatNairobiDate } from '@/lib/dates'
import { pageUser } from '@/lib/page-access'
import { formatKES } from '@/lib/money'
import { PrintButton } from '@/components/print-button'
import { notFound } from 'next/navigation'
import { adminReadService } from '@/modules/admin/read-service'

export default async function PaymentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser('COMMITTEE')
  const { id } = await params
  const payment = await adminReadService.paymentReceipt(id)

  if (!payment) {
    return <section className="card"><h1>Receipt not found</h1><Link className="btn-primary" href="/admin/payments">Back to payments</Link></section>
  }

  if (payment.status !== 'SUCCESS') notFound()

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3 print-hide">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Payment receipt</p>
        <h1>Eagles Drama Club</h1>
      </div>
      <PrintButton />
    </div>

    <section className="card max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-sm text-slate-500">Receipt number</p>
          <p className="text-lg font-semibold">{payment.id}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Paid on</p>
          <p className="font-semibold">{formatNairobiDate(payment.paidAt ?? payment.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Member</p>
          <p className="font-semibold">{payment.member.fullName}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Email</p>
          <p>{payment.member.email}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Fee type</p>
          <p>{payment.type}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Amount</p>
          <p>{formatKES(payment.amount)}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Method</p>
          <p>{payment.method}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Reference</p>
          <p>{payment.mpesaReceipt ?? payment.reference ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Payment source</p>
          <p>{payment.source === 'MEMBER_REPORTED' ? 'Member reported; committee reviewed' : payment.source === 'PAYHERO_CHECKOUT' ? 'PayHero checkout' : payment.source === 'PROVIDER_VERIFIED' ? 'Provider verified' : 'Admin recorded'}</p>
        </div>
      </div>

      <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Status</p>
        <p>{payment.status}</p>
      </div>
    </section>

    <Link className="btn-secondary print-hide" href="/admin/payments">Back to payments</Link>
  </div>
}
