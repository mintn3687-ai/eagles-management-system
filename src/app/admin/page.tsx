import Link from 'next/link'
import { z } from 'zod'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { getDashboardData } from '@/lib/admin-data'
import { getClubSettings } from '@/lib/admin-settings'
import { currentNairobiMonth } from '@/lib/attendance-analytics'
import { formatNairobiDate } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import { memberStatuses } from '@/lib/validation/members'
import { CreateInviteForm } from '@/components/create-invite-form'
import { CopyFeeReminder, CopyMessageButton } from '@/components/admin/copy-message-button'
import { SessionControls } from '@/components/rehearsals/session-controls'
import { SignOut } from '@/components/sign-out'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const labels: Record<string, string> = {
  PENDING_REGISTRATION: 'Pending registration', ACTIVE: 'Active', INACTIVE: 'Inactive', SUSPENDED: 'Suspended', ALUMNI: 'Alumni',
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ page?: string; overduePage?: string }> }) {
  const actor = await pageUser('COMMITTEE')
  const params = await searchParams
  const requestedPage = pageSchema.parse(params.page ?? 1)
  const overduePage = pageSchema.parse(params.overduePage ?? 1)
  const inviteWhere = { isActive: true, passwordHash: null, ...(actor.role === 'SUPER_ADMIN' ? {} : { role: 'MEMBER' as const }) }
  const inviteTotal = await prisma.user.count({ where: inviteWhere })
  const invitationPageCount = Math.max(1, Math.ceil(inviteTotal / 20))
  const page = Math.min(requestedPage, invitationPageCount)
  const [dashboard, settings, users] = await Promise.all([
    getDashboardData(overduePage),
    getClubSettings(),
    prisma.user.findMany({
      where: inviteWhere,
      select: { id: true, name: true, email: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 21,
    }),
  ])
  const statusCounts = new Map(dashboard.membersByStatus.map((row) => [row.status, row._count._all]))
  const rehearsalMessage = dashboard.nextRehearsal
    ? `Reminder: ${settings.clubName} rehearsal “${dashboard.nextRehearsal.title}” is on ${formatNairobiDate(dashboard.nextRehearsal.date)} from ${dashboard.nextRehearsal.startTime} to ${dashboard.nextRehearsal.endTime} at ${dashboard.nextRehearsal.venue}. Please arrive on time.`
    : ''
  return <div className="space-y-6">
    <section className="card space-y-3">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Committee dashboard</p>
      <h1>{settings.clubName}</h1>
      <p className="text-slate-600">Welcome, {actor.name}. Manage club work from this page.</p>
      <div className="flex flex-wrap gap-3"><Link className="btn-primary" href="/admin/members/new">Add member</Link><Link className="btn-secondary" href="/admin/rehearsals">Manage rehearsals</Link></div>
    </section>

    <section className="card space-y-4"><div><h2>Members by status</h2><p className="text-sm text-slate-600">Current membership register.</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{memberStatuses.map((status) => <Link key={status} className="rounded-xl border border-slate-200 p-4 hover:bg-stone-50" href={`/admin/members?status=${status}`}><span className="block text-2xl font-semibold">{statusCounts.get(status) ?? 0}</span><span className="text-sm text-slate-600">{labels[status]}</span></Link>)}</div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="card space-y-3"><h2>Next rehearsal</h2>{dashboard.nextRehearsal ? <>
        <p className="font-semibold">{dashboard.nextRehearsal.title}</p><p className="text-sm text-slate-600">{formatNairobiDate(dashboard.nextRehearsal.date)} · {dashboard.nextRehearsal.startTime}–{dashboard.nextRehearsal.endTime} · {dashboard.nextRehearsal.venue}</p>
        <p className="text-sm">Status: {dashboard.nextRehearsal.status.toLowerCase()}</p>
        <Link className="btn-secondary" href={`/admin/rehearsals/${dashboard.nextRehearsal.id}`}>Open rehearsal controls</Link>
        {dashboard.nextRehearsal.status === 'SCHEDULED' && <SessionControls rehearsalId={dashboard.nextRehearsal.id} />}
        <CopyMessageButton message={rehearsalMessage} label="Copy rehearsal WhatsApp reminder" />
      </> : <p className="text-slate-600">No upcoming rehearsals are scheduled.</p>}<Link className="inline-flex min-h-11 items-center underline" href="/admin/rehearsals">View rehearsal schedule</Link></article>
      <article className="card space-y-3"><h2>Pending absence reviews</h2><p className="text-4xl font-semibold">{dashboard.pendingAbsences}</p><p className="text-slate-600">Absences and missing check-ins awaiting committee review.</p><Link className="btn-secondary" href="/admin/absences">Review absences</Link></article>
    </section>

    <section className="card space-y-4"><div><h2>This month’s payments</h2><p className="text-sm text-slate-600">Successful payments for {currentNairobiMonth()} (Nairobi time).</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{(['REGISTRATION', 'SUBSCRIPTION'] as const).map((type) => <article className="rounded-xl bg-stone-50 p-4" key={type}><h3>{type === 'REGISTRATION' ? 'Registration' : 'Subscription'}</h3><p className="mt-2 text-2xl font-semibold">{formatKES(dashboard.totals[type].amount)}</p><p className="text-sm text-slate-600">{dashboard.totals[type].count} successful {dashboard.totals[type].count === 1 ? 'payment' : 'payments'}</p></article>)}</div>
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/payments">Open payment ledger</Link>
    </section>

    <section className="card space-y-4"><div><h2>Overdue subscriptions</h2><p className="text-sm text-slate-600">Latest successful subscription is past its billing period and grace days. {dashboard.overdueTotal} overdue.</p></div>
      {dashboard.overdueSubscriptions.length ? <CopyFeeReminder members={dashboard.overdueSubscriptions} /> : <p className="text-slate-600">No overdue subscriptions.</p>}
      <nav className="flex gap-3" aria-label="Overdue subscription pages">{dashboard.overduePage > 1 && <Link className="btn-secondary" href={`/admin?overduePage=${dashboard.overduePage - 1}`}>Previous</Link>}{dashboard.overduePage < dashboard.overduePageCount && <Link className="btn-secondary" href={`/admin?overduePage=${dashboard.overduePage + 1}`}>Next</Link>}</nav>
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/payments?type=SUBSCRIPTION">View subscription payments</Link>
    </section>

    <section className="card space-y-4"><div><h2>Accounts waiting for an invitation</h2><p className="text-sm text-slate-600">Create a private invitation for an account that has not set a password.</p></div>
      {users.length ? <CreateInviteForm users={users.slice(0, 20)} /> : <p className="text-slate-600">No accounts awaiting invitations on this page.</p>}
      <p className="text-sm text-slate-500">Page {page} of {invitationPageCount} · {inviteTotal} accounts</p><nav aria-label="Invitation account pages" className="flex gap-3">{page > 1 && <Link className="btn-secondary" href={`/admin?page=${page - 1}`}>Previous</Link>}{page < invitationPageCount && <Link className="btn-secondary" href={`/admin?page=${page + 1}`}>Next</Link>}</nav>
    </section>
    <div className="flex flex-wrap gap-3"><Link className="btn-secondary" href="/member">Member home</Link><SignOut /></div>
  </div>
}
