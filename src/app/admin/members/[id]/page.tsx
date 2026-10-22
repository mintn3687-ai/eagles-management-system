import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { getMemberDetail } from '@/modules/members/service'
import { MemberForm } from '@/components/members/member-form'
import { RegenerateInviteForm, RoleForm, StatusForm } from '@/components/members/member-controls'
import { formatNairobiDate } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import { hasPermission } from '@/lib/permissions'
import { DataTable } from '@/components/ui/data-table'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pagePermission('members:read')
  const parsed = userIdSchema.safeParse((await params).id)
  if (!parsed.success) notFound()
  const member = await getMemberDetail(parsed.data)
  if (!member) notFound()
  const attendanceColumns = [
    { key: 'date', header: 'Rehearsal', render: (row: typeof member.attendances[number]) => <>{row.rehearsal.title}<span className="block text-slate-500">{formatNairobiDate(row.rehearsal.date)}</span></> },
    { key: 'status', header: 'Attendance', render: (row: typeof member.attendances[number]) => row.status.replaceAll('_', ' ') },
    { key: 'review', header: 'Review', render: (row: typeof member.attendances[number]) => row.reviewStatus === 'EXCUSED' ? 'Excused' : row.reviewStatus === 'UNEXCUSED' ? 'Unexcused' : '—' },
  ]
  const paymentColumns = [
    { key: 'date', header: 'Date', render: (row: typeof member.payments[number]) => formatNairobiDate(row.paidAt ?? row.createdAt) },
    { key: 'type', header: 'Type', render: (row: typeof member.payments[number]) => row.type },
    { key: 'amount', header: 'Amount', render: (row: typeof member.payments[number]) => formatKES(row.amount) },
    { key: 'status', header: 'Status', render: (row: typeof member.payments[number]) => row.status },
  ]
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/admin/members">Back to members</Link>
    <div><h1>{member.fullName}</h1><p>{member.status.replaceAll('_', ' ')} · Joined {formatNairobiDate(member.joinedAt)}</p></div>
    <section className="card">
      <h2>Member details</h2>
      {(!member.emergencyContactName || !member.emergencyContactPhone) && <p className="mb-5 rounded-lg bg-amber-50 p-4">Emergency contact details are missing. Please complete them.</p>}
      <MemberForm member={member} />
    </section>
    <section className="card"><h2>Membership status</h2><StatusForm memberId={member.id} status={member.status} /></section>
    {member.userId && <section className="card"><h2>Invitation and password reset</h2><RegenerateInviteForm memberId={member.id} /></section>}
    {hasPermission(actor.role, 'team:manage') && member.user && <section className="card"><h2>Login permissions</h2><RoleForm memberId={member.id} role={member.user.role} /></section>}
    <section className="card space-y-4">
      <div><h2>Attendance summary</h2><p className="text-sm text-slate-600">Closed rehearsals where this member was eligible, using the club’s shared attendance rules.</p></div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Attendance rate" value={`${member.attendance.percent}%`} />
        <Summary label="Present" value={member.attendance.present} />
        <Summary label="Excused" value={member.attendance.excused} />
        <Summary label="Missed" value={member.attendance.missed} />
      </div>
      <DataTable rows={member.attendances} columns={attendanceColumns} emptyMessage="No closed-rehearsal attendance records yet." />
    </section>
    <section className="card space-y-4">
      <div><h2>Payment summary</h2><p className="text-sm text-slate-600">{member.currentMembership ? `${member.currentMembership.season.name} · ${member.currentMembership.status.replaceAll('_', ' ')}` : 'No current-season membership record.'}</p></div>
      {member.currentMembership
        ? <div className="grid gap-3 sm:grid-cols-2">
          <Summary label="Fees paid this season" value={formatKES(member.currentMembership.feesPaid)} />
          <Summary label="Fees owed this season" value={formatKES(member.currentMembership.feesOwed)} />
        </div>
        : <p className="rounded-lg bg-stone-50 p-4 text-sm text-slate-600">Season fee totals will appear when this member has a current-season membership.</p>}
      <h3>Recent payment activity</h3>
      <DataTable rows={member.payments} columns={paymentColumns} emptyMessage="No payment activity recorded." />
    </section>
  </div>
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-stone-50 p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>
}
