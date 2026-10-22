import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await pageUser('COMMITTEE')
  return <div className="space-y-6">
    <nav className="flex flex-wrap gap-2" aria-label="Committee navigation">
      <Link className="btn-secondary" href="/admin">Dashboard</Link>
      <Link className="btn-secondary" href="/admin/members">Members</Link>
      <Link className="btn-secondary" href="/admin/rehearsals">Rehearsals</Link>
      <Link className="btn-secondary" href="/admin/meetings">Meetings</Link>
      <Link className="btn-secondary" href="/admin/elections">Elections</Link>
      <Link className="btn-secondary" href="/admin/productions">Productions</Link>
      <Link className="btn-secondary" href="/admin/finance">Finance</Link>
      <Link className="btn-secondary" href="/admin/analytics">Attendance</Link>
      <Link className="btn-secondary" href="/admin/absences">Absences</Link>
      <Link className="btn-secondary" href="/admin/payments">Payments</Link>
      <Link className="btn-secondary" href="/admin/fees">Fees</Link>
      <Link className="btn-secondary" href="/admin/audit">Audit log</Link>
      {actor.role === 'SUPER_ADMIN' && <>
        <Link className="btn-secondary" href="/admin/settings">Settings</Link>
        <Link className="btn-secondary" href="/admin/team">Team</Link>
        <Link className="btn-secondary" href="/admin/rollover">Season rollover</Link>
        <a className="btn-secondary" href="/admin/export">Export all data</a>
      </>}
    </nav>
    {children}
  </div>
}
