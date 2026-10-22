import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { prisma } from '@/lib/db'
import { MemberForm } from '@/components/members/member-form'
import { RegenerateInviteForm, RoleForm, StatusForm } from '@/components/members/member-controls'
import { formatNairobiDate } from '@/lib/dates'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageUser('COMMITTEE')
  const parsed = userIdSchema.safeParse((await params).id)
  if (!parsed.success) notFound()
  const member = await prisma.member.findUnique({ where: { id: parsed.data }, select: {
    id: true, fullName: true, phone: true, email: true, studentRegNo: true, emergencyContactName: true,
    emergencyContactPhone: true, notes: true, status: true, joinedAt: true, userId: true,
    user: { select: { role: true } },
  } })
  if (!member) notFound()
  return <div className="space-y-6"><Link className="inline-flex min-h-11 items-center underline" href="/admin/members">Back to members</Link><div><h1>{member.fullName}</h1><p>{member.status.replaceAll('_', ' ')} · Joined {formatNairobiDate(member.joinedAt)}</p></div><section className="card"><h2>Member details</h2>{(!member.emergencyContactName || !member.emergencyContactPhone) && <p className="mb-5 rounded-lg bg-amber-50 p-4">Emergency contact details are missing. Please complete them.</p>}<MemberForm member={member} /></section><section className="card"><h2>Membership status</h2><StatusForm memberId={member.id} status={member.status} /></section>{member.userId && <section className="card"><h2>Invitation and password reset</h2><RegenerateInviteForm memberId={member.id} /></section>}{actor.role === 'SUPER_ADMIN' && member.user && <section className="card"><h2>Login permissions</h2><RoleForm memberId={member.id} role={member.user.role} /></section>}<section className="card"><h2>Attendance summary</h2><p className="text-slate-500">Attendance summaries will be available in a later phase.</p></section><section className="card"><h2>Payment summary</h2><p className="text-slate-500">Registration and subscription payment summaries will be available in a later phase.</p></section></div>
}
