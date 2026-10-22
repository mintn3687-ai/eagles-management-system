import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { userIdSchema } from '@/lib/validation'
import { formatNairobiDate } from '@/lib/dates'
import { AttendanceSheet } from '@/components/rehearsals/attendance-sheet'
import { EditRehearsalForm } from '@/components/rehearsals/edit-form'
import { SessionControls } from '@/components/rehearsals/session-controls'
import { CancelRehearsalForm } from '@/components/rehearsals/cancel-form'
import { z } from 'zod'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 20

export default async function RehearsalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  await pageUser('COMMITTEE')
  const parsed = userIdSchema.safeParse((await params).id)
  if (!parsed.success) notFound()
  const rehearsal = await prisma.rehearsal.findUnique({
    where: { id: parsed.data },
    select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true, checkInCode: true, createdBy: { select: { name: true } } },
  })
  if (!rehearsal) notFound()
  const requestedPage = pageSchema.parse((await searchParams).page ?? '1')
  const totalActive = await prisma.member.count({ where: { status: 'ACTIVE' } })
  const pageCount = Math.max(1, Math.ceil(totalActive / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const members = await prisma.member.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true, fullName: true, phone: true, joinedAt: true,
      rehearsals: { where: { rehearsalId: rehearsal.id }, select: { id: true, status: true, markedBy: true, reason: true, reviewStatus: true } },
    },
    orderBy: { fullName: 'asc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })
  return <div className="space-y-6">
    <div>
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/rehearsals">← Rehearsals</Link>
      <h1>{rehearsal.title}</h1>
      <p className="text-slate-600">{formatNairobiDate(rehearsal.date, true)} · {rehearsal.startTime} – {rehearsal.endTime} · {rehearsal.venue}</p>
      <p className="text-sm text-slate-500">Created by {rehearsal.createdBy.name} · Status: {rehearsal.status}{rehearsal.checkInCode && rehearsal.status === 'OPEN' && (<span> · Code: <span className="font-mono text-2xl">{rehearsal.checkInCode}</span></span>)}</p>
    </div>
    {rehearsal.status === 'SCHEDULED' && <SessionControls rehearsalId={rehearsal.id} />}
    {rehearsal.status === 'OPEN' && <SessionControls rehearsalId={rehearsal.id} state="open" checkInCode={rehearsal.checkInCode} />}
    {rehearsal.status === 'SCHEDULED' && <EditRehearsalForm rehearsal={rehearsal} />}
    {rehearsal.status !== 'CANCELLED' && <CancelRehearsalForm rehearsalId={rehearsal.id} />}
    <AttendanceSheet rehearsal={rehearsal} members={members} totalActive={totalActive} page={page} pageCount={pageCount} />
  </div>
}
