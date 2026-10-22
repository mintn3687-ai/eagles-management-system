import Link from 'next/link'
import { z } from 'zod'
import { pageUser } from '@/lib/page-access'
import { formatNairobiDate } from '@/lib/dates'
import { getCurrentFee } from '@/lib/fees'
import { formatKES } from '@/lib/money'
import { saveFeeSettingAction } from './actions'
import { adminReadService } from '@/modules/admin/read-service'

const PAGE_SIZE = 20
const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)

export default async function FeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await pageUser('COMMITTEE')
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : ''
  const success = typeof params.success === 'string' ? params.success : ''
  const requestedPage = pageSchema.parse(params.historyPage ?? '1')
  const historyTotal = await adminReadService.feeHistoryCount()
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE))
  const historyPage = Math.min(requestedPage, historyPageCount)

  const [registration, subscription, history] = await Promise.all([
    getCurrentFee('REGISTRATION'),
    getCurrentFee('SUBSCRIPTION'),
    adminReadService.feeHistoryPage(historyPage, PAGE_SIZE),
  ])

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Fee settings</p>
        <h1>Registration and subscription fees</h1>
      </div>
      <Link className="btn-secondary" href="/admin/payments">View ledger</Link>
    </div>

    {error && <p className="error">{error}</p>}
    {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}

    <div className="grid gap-4 md:grid-cols-2">
      <section className="card">
        <h2>Registration fee</h2>
        {registration ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Amount:</strong> {formatKES(registration.amount)}</p>
            <p><strong>Effective from:</strong> {formatNairobiDate(registration.effectiveFrom)}</p>
            <p><strong>Reason:</strong> {registration.reason}</p>
          </div>
        ) : <p>No registration fee has been set yet.</p>}
      </section>

      <section className="card">
        <h2>Subscription fee</h2>
        {subscription ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Amount:</strong> {formatKES(subscription.amount)}</p>
            <p><strong>Billing period:</strong> {subscription.billingPeriod ?? 'Monthly'}</p>
            <p><strong>Effective from:</strong> {formatNairobiDate(subscription.effectiveFrom)}</p>
            <p><strong>Reason:</strong> {subscription.reason}</p>
          </div>
        ) : <p>No subscription fee has been set yet.</p>}
      </section>
    </div>

    <section className="card">
      <h2>Fee history</h2>
      {history.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Period</th>
                <th className="p-3">Effective from</th>
                <th className="p-3">Reason</th>
                <th className="p-3">By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((setting) => (
                <tr className="border-t border-slate-200" key={setting.id}>
                  <td className="p-3">{setting.type.replaceAll('_', ' ')}</td>
                  <td className="p-3">{formatKES(setting.amount)}</td>
                  <td className="p-3">{setting.billingPeriod ? setting.billingPeriod.replaceAll('_', ' ') : 'One-time'}</td>
                  <td className="p-3">{formatNairobiDate(setting.effectiveFrom)}</td>
                  <td className="p-3">{setting.reason}</td>
                  <td className="p-3">{setting.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No fee changes have been saved yet.</p>}
      <p className="mt-3 text-sm text-slate-500">{historyTotal} fee changes · Page {historyPage} of {historyPageCount}</p>
      <nav className="mt-3 flex gap-3" aria-label="Fee history pages">{historyPage > 1 && <Link className="btn-secondary" href={`/admin/fees?historyPage=${historyPage - 1}`}>Previous</Link>}{historyPage < historyPageCount && <Link className="btn-secondary" href={`/admin/fees?historyPage=${historyPage + 1}`}>Next</Link>}</nav>
    </section>

    {actor.role === 'SUPER_ADMIN' && (
      <section className="card">
        <h2>New fee setting</h2>
        <form action={saveFeeSettingAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="type">Fee type</label>
            <select className="input" id="type" name="type" defaultValue="REGISTRATION">
              <option value="REGISTRATION">Registration</option>
              <option value="SUBSCRIPTION">Subscription</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="amount">Amount (KES)</label>
            <input className="input" id="amount" name="amount" type="number" min={1} step={1} defaultValue={registration?.amount ?? 500} required />
          </div>

          <div>
            <label className="label" htmlFor="billingPeriod">Billing period</label>
            <select className="input" id="billingPeriod" name="billingPeriod" defaultValue={subscription?.billingPeriod ?? 'MONTHLY'}>
              <option value="">One-time</option>
              <option value="MONTHLY">Monthly</option>
              <option value="TERM">Term</option>
              <option value="YEAR">Year</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label" htmlFor="reason">Reason for this change</label>
            <textarea className="input" id="reason" name="reason" rows={3} required placeholder="e.g. Committee approved a new annual fee schedule in line with club costs." />
          </div>

          <button className="btn-primary md:col-span-2" type="submit">Create new fee setting</button>
        </form>
      </section>
    )}
  </div>
}
