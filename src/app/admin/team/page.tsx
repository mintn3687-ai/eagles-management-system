import Link from 'next/link'
import { z } from 'zod'
import { pageUser } from '@/lib/page-access'
import { TeamRoleForm, TransferAdminForm } from '@/components/admin/team-forms'
import { adminReadService } from '@/modules/admin/read-service'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 20

export default async function AdminTeamPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageUser('SUPER_ADMIN')
  const requestedPage = pageSchema.parse((await searchParams).page ?? '1')
  const total = await adminReadService.teamCount()
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const rows = await adminReadService.teamPage(page, PAGE_SIZE)
  const transferMembers = rows.filter((member) => member.status === 'ACTIVE' && member.user?.isActive && member.user.role !== 'SUPER_ADMIN')
  return <div className="space-y-6">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Super Admin</p><h1>Committee team</h1><p className="text-slate-600">Change Member and Committee access, or transfer Super Admin access.</p></div>
    <section className="card space-y-4"><h2>Member logins</h2>
      {rows.length ? <div className="space-y-4">{rows.map((member) => <article key={member.id} className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3"><p className="font-semibold">{member.fullName}</p><p className="text-sm text-slate-600">{member.user?.email ?? 'No linked login'}</p></div>
        {member.user?.role === 'SUPER_ADMIN' ? <p className="text-sm font-medium text-emerald-900">Super Admin</p> : member.user && <TeamRoleForm memberId={member.id} role={member.user.role} />}
      </article>)}</div> : <p className="text-slate-600">No member accounts have logins yet.</p>}
      <p className="text-sm text-slate-500">Page {page} of {pageCount} · {total} linked member accounts</p>
      <nav className="flex gap-3" aria-label="Team pages">{page > 1 && <Link className="btn-secondary" href={`/admin/team?page=${page - 1}`}>Previous</Link>}{page * PAGE_SIZE < total && <Link className="btn-secondary" href={`/admin/team?page=${page + 1}`}>Next</Link>}</nav>
    </section>
    <section className="card space-y-4"><h2>Transfer Super Admin</h2><p className="text-slate-600">Transfer access to another member account. The current Super Admin becomes a Committee account.</p>
      {transferMembers.length ? <><p className="text-sm text-slate-600">Choose from active member accounts on this page. Use the team pages above to find another account.</p><TransferAdminForm members={transferMembers} /></> : <p className="text-slate-600">No eligible account appears on this page. Use the team pages above to find an active member account.</p>}
    </section>
  </div>
}
