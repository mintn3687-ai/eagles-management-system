import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { formatNairobiDate } from '@/lib/dates'
import { listMemberCallSheets } from '@/modules/productions/service'

export default async function MemberProductionsPage() {
  const user = await pagePermission('productions:read')
  if (!user.member) redirect('/forbidden')
  if (user.member.status !== 'ACTIVE') redirect('/member')
  const calls = await listMemberCallSheets(user.member.id)
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/member">Back to home</Link>
    <header><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Productions</p><h1>My call sheets</h1><p className="text-slate-600">Upcoming show and call information for productions that have called you.</p></header>
    {calls.length
      ? <ul className="space-y-4">{calls.map(({ callSheet }) => <li className="card space-y-2" key={callSheet.id}>
        <h2>{callSheet.title}</h2>
        <p className="text-sm text-slate-600">{callSheet.showDate.production.title} · {formatNairobiDate(callSheet.showDate.startsAt, true)} · {callSheet.showDate.venue}</p>
        <p><strong>Call:</strong> {formatNairobiDate(callSheet.callAt, true)}</p>
        {callSheet.notes && <p className="whitespace-pre-wrap">{callSheet.notes}</p>}
      </li>)}</ul>
      : <section className="card"><p className="text-slate-600">You have no upcoming call sheets.</p></section>}
  </div>
}
