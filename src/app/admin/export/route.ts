import { AccessError, requireRole } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { formatNairobiDate, nairobiDateKey } from '@/lib/dates'
import { createZip, type ZipFile } from '@/lib/zip'

export const runtime = 'nodejs'

function csvCell(value: unknown) {
  let text = value instanceof Date ? formatNairobiDate(value, true) : typeof value === 'string' ? value : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

async function csvFromPages<T extends { id: string }>(
  headers: string[],
  loadPage: (cursor?: string) => Promise<T[]>,
  values: (row: T) => unknown[],
) {
  const pageSize = 500
  let content = `\uFEFF${headers.map(csvCell).join(',')}`
  let cursor: string | undefined
  while (true) {
    const rows = await loadPage(cursor)
    if (!rows.length) break
    content += `\r\n${rows.map((row) => values(row).map(csvCell).join(',')).join('\r\n')}`
    cursor = rows[rows.length - 1].id
    if (rows.length < pageSize) break
  }
  return content
}

export async function GET() {
  try { await requireRole('SUPER_ADMIN') }
  catch (error) {
    const status = error instanceof AccessError ? error.status : 403
    return new Response('Super Admin access is required for the data export.', { status, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const files: ZipFile[] = [
      { name: 'members.csv', content: await csvFromPages(
        ['id', 'userId', 'fullName', 'phone', 'email', 'studentRegNo', 'emergencyContactName', 'emergencyContactPhone', 'status', 'joinedAt', 'notes', 'createdAt', 'loginEmail', 'loginRole', 'loginActive'],
        (cursor) => prisma.member.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { user: { select: { email: true, role: true, isActive: true } } } }),
        (m) => [m.id, m.userId, m.fullName, m.phone, m.email, m.studentRegNo, m.emergencyContactName, m.emergencyContactPhone, m.status, m.joinedAt, m.notes, m.createdAt, m.user?.email, m.user?.role, m.user?.isActive],
      ) },
      { name: 'rehearsals.csv', content: await csvFromPages(
        ['id', 'title', 'date', 'startTime', 'endTime', 'venue', 'status', 'checkInCode', 'createdById'],
        (cursor) => prisma.rehearsal.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
        (r) => [r.id, r.title, r.date, r.startTime, r.endTime, r.venue, r.status, r.checkInCode, r.createdById],
      ) },
      { name: 'attendance.csv', content: await csvFromPages(
        ['id', 'memberId', 'memberName', 'rehearsalId', 'rehearsalTitle', 'rehearsalDate', 'status', 'markedBy', 'markedAt', 'reason', 'reviewStatus', 'reviewNote', 'reviewedById', 'reviewedAt', 'wrongCodeTries'],
        (cursor) => prisma.attendance.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { member: { select: { fullName: true } }, rehearsal: { select: { title: true, date: true } } } }),
        (a) => [a.id, a.memberId, a.member.fullName, a.rehearsalId, a.rehearsal.title, a.rehearsal.date, a.status, a.markedBy, a.markedAt, a.reason, a.reviewStatus, a.reviewNote, a.reviewedById, a.reviewedAt, a.wrongCodeTries],
      ) },
      { name: 'payments.csv', content: await csvFromPages(
        ['id', 'memberId', 'memberName', 'type', 'amountKES', 'status', 'method', 'phone', 'checkoutRequestId', 'reference', 'receipt', 'periodStart', 'periodEnd', 'resultDesc', 'recordedById', 'createdAt', 'paidAt'],
        (cursor) => prisma.payment.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { member: { select: { fullName: true } } } }),
        (p) => [p.id, p.memberId, p.member.fullName, p.type, p.amount, p.status, p.method, p.phone, p.checkoutRequestId, p.reference, p.mpesaReceipt, p.periodStart, p.periodEnd, p.resultDesc, p.recordedById, p.createdAt, p.paidAt],
      ) },
      { name: 'audit.csv', content: await csvFromPages(
        ['id', 'actorId', 'actorName', 'actorEmail', 'action', 'entity', 'entityId', 'details', 'createdAt'],
        (cursor) => prisma.auditLog.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { actor: { select: { name: true, email: true } } } }),
        (a) => [a.id, a.actorId, a.actor.name, a.actor.email, a.action, a.entity, a.entityId, a.details, a.createdAt],
      ) },
    ]
    const body = createZip(files)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="eagles-drama-club-export-${nairobiDateKey()}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('Could not prepare the export. Please try again.', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
