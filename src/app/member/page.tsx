import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { isRestricted } from '@/lib/permissions'
import { getMemberDashboard } from '@/lib/rehearsals/service'
import { formatNairobiDate } from '@/lib/dates'
import { SignOut } from '@/components/sign-out'

export default async function MemberPage() {
  const user = await pageUser()
  if (user.member?.status === 'PENDING_REGISTRATION') redirect('/member/fees')
  if (isRestricted(user)) return <section className="card space-y-6"><h1>Contact the committee</h1><p>Your membership is currently {user.member!.status.toLowerCase()}. Please contact the committee for help with your account.</p><SignOut /></section>
  if (!user.consentAcceptedAt) redirect('/consent')
  const isMember = Boolean(user.member)
  const { today, next } = isMember ? await getMemberDashboard() : { today: null, next: null }
  return <section className="card space-y-6">
    <div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Member home</p>
      <h1>Welcome, {user.member?.fullName ?? user.name}</h1>
      <p className="text-slate-600">Membership status: <strong>{user.member?.status.replaceAll('_', ' ') ?? 'Staff account'}</strong></p>
    </div>
    {isMember && today && (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">Today’s rehearsal: {today.title}</p>
        <p className="text-sm text-emerald-800">{formatNairobiDate(today.date)} · {today.startTime} – {today.endTime} · {today.venue}</p>
        {<Link className="btn-secondary mt-2 w-full" href="/member/attendance">View attendance / check in</Link>}
        {today.status === 'SCHEDULED' && <p className="mt-2 text-sm text-slate-600">This session will open soon.</p>}
      </div>
    )}
    {isMember && !today && next && (
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">Next rehearsal: {next.title}</p>
        <p className="text-sm text-slate-600">{formatNairobiDate(next.date)} · {next.startTime} – {next.endTime}</p>
        <Link className="btn-secondary mt-2 w-full" href="/member/attendance">View attendance</Link>
      </div>
    )}
    {isMember && <Link className="btn-secondary w-full" href="/member/attendance">Mark attendance</Link>}
    {user.member?.status === 'ACTIVE' && <Link className="btn-secondary w-full" href="/member/stats">My monthly stats</Link>}
    {user.member?.status === 'ACTIVE' && <Link className="btn-secondary w-full" href="/member/fees">Subscription fee</Link>}
    {user.member?.status === 'ACTIVE' && <Link className="btn-secondary w-full" href="/member/reimbursements">My reimbursements</Link>}
    {isMember && <Link className="btn-secondary w-full" href="/member/meetings">Meetings and action items</Link>}
    {isMember && user.member?.status === 'ACTIVE' && <Link className="btn-secondary w-full" href="/member/productions">My production call sheets</Link>}
    {isMember && user.member?.status === 'ACTIVE' && <Link className="btn-secondary w-full" href="/member/elections">Elections and voting</Link>}
    {isMember && <Link className="btn-secondary w-full" href="/member/history">Attendance history</Link>}
    <p>You’re signed in to Eagles Drama Club.</p>
    <div className="flex flex-wrap gap-3">
      {user.role !== 'MEMBER' && <Link className="btn-primary" href="/admin">Committee home</Link>}
      <SignOut />
    </div>
  </section>
}
