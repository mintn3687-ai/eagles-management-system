import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { formatNairobiDate, nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { attendanceWindowClosed } from '@/lib/attendance-rules'
import { AttendanceSheet } from '@/components/rehearsals/attendance-sheet'
import { EditRehearsalForm } from '@/components/rehearsals/edit-form'
import { SessionControls } from '@/components/rehearsals/session-controls'
import { CancelRehearsalForm } from '@/components/rehearsals/cancel-form'
import { z } from 'zod'
import { adminReadService } from '@/modules/admin/read-service'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 20

export default async function RehearsalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  await pageUser('COMMITTEE')
  const parsed = userIdSchema.safeParse((await params).id)
  if (!parsed.success) notFound()
  const rehearsal = await adminReadService.rehearsal(parsed.data)
  if (!rehearsal) notFound()
  const requestedPage = pageSchema.parse((await searchParams).page ?? '1')
  const totalMembers = await adminReadService.attendanceSheetMemberCount(rehearsal.id)
  const pageCount = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const members = await adminReadService.attendanceSheetMembers(rehearsal.id, page, PAGE_SIZE)
  const attendanceLocked = rehearsal.status === 'CLOSED' || rehearsal.status === 'CANCELLED'
    || attendanceWindowClosed(parseNairobiDate(nairobiDateKey(rehearsal.date), rehearsal.endTime))
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
    <AttendanceSheet rehearsal={rehearsal} members={members} totalMembers={totalMembers} page={page} pageCount={pageCount} locked={attendanceLocked} />
  </div>
}
