import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await pageUser('COMMITTEE')
  return <div className="space-y-6">
    <nav className="flex flex-wrap gap-2" aria-label="Committee navigation">
      <Link className="btn-secondary" href="/admin" prefetch={false}>Dashboard</Link>
      <Link className="btn-secondary" href="/admin/members" prefetch={false}>Members</Link>
      <Link className="btn-secondary" href="/admin/rehearsals" prefetch={false}>Rehearsals</Link>
      <Link className="btn-secondary" href="/admin/meetings" prefetch={false}>Meetings</Link>
      <Link className="btn-secondary" href="/admin/elections" prefetch={false}>Elections</Link>
      <Link className="btn-secondary" href="/admin/productions" prefetch={false}>Productions</Link>
      <Link className="btn-secondary" href="/admin/festivals" prefetch={false}>Festivals</Link>
      <Link className="btn-secondary" href="/admin/finance" prefetch={false}>Finance</Link>
      <Link className="btn-secondary" href="/admin/analytics" prefetch={false}>Attendance</Link>
      <Link className="btn-secondary" href="/admin/absences" prefetch={false}>Absences</Link>
      <Link className="btn-secondary" href="/admin/payments" prefetch={false}>Payments</Link>
      <Link className="btn-secondary" href="/admin/fees" prefetch={false}>Fees</Link>
      <Link className="btn-secondary" href="/admin/audit" prefetch={false}>Audit log</Link>
      {actor.role === 'SUPER_ADMIN' && <>
        <Link className="btn-secondary" href="/admin/settings" prefetch={false}>Settings</Link>
        <Link className="btn-secondary" href="/admin/team" prefetch={false}>Team</Link>
        <Link className="btn-secondary" href="/admin/rollover" prefetch={false}>Season rollover</Link>
        <a className="btn-secondary" href="/admin/export">Export all data</a>
      </>}
    </nav>
    {children}
  </div>
}
