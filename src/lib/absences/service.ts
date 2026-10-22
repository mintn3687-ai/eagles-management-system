import { lockRow } from '../row-lock'
import 'server-only'
import { z } from 'zod'
import { Prisma, type AttendanceStatus, type ReviewStatus } from '@prisma/client'
import { prisma } from '../db'
import { requireRole, AccessError } from '../permissions'
import { reviewSingleSchema, reviewBulkSchema, absenceListSchema, type AbsenceFilters } from '../validation/absences'
import { nairobiMonthBounds } from '../dates'

export class AbsenceError extends Error {}
export type AbsenceListItem = Awaited<ReturnType<typeof listAbsences>>['records'][number]
export function absenceErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0].message
  if (error instanceof AbsenceError || error instanceof AccessError) return error.message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return 'Record not found.'
  return 'Could not save the change. Please try again.'
}

async function getActor() {
  return requireRole('COMMITTEE')
}

function buildWhere(filters: AbsenceFilters): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = {
    reviewStatus: 'PENDING',
    status: { in: ['ABSENT', 'NO_RESPONSE'] },
  }
  if (filters.rehearsalId) where.rehearsalId = filters.rehearsalId
  if (filters.memberId) where.memberId = filters.memberId
  if (filters.status) where.status = filters.status as AttendanceStatus
  if (filters.month) {
    const { start, end } = nairobiMonthBounds(parseNairobiMonth(filters.month))
    where.rehearsal = { date: { gte: start, lt: end } }
  }
  return where
}

function parseNairobiMonth(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+03:00`)
}

export async function listAbsences(filters: AbsenceFilters) {
  await getActor()
  const page = absenceListSchema.shape.page.parse(filters.page ?? '1')
  const where = buildWhere(absenceListSchema.parse(filters))
  const [records, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      orderBy: [{ markedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 21,
      select: {
        id: true, status: true, reason: true, reviewStatus: true, markedAt: true,
        member: { select: { id: true, fullName: true, phone: true } },
        rehearsal: { select: { id: true, title: true, date: true, startTime: true, endTime: true } },
      },
    }),
    prisma.attendance.count({ where }),
  ])
  return { records, total, page }
}

export async function countPendingAbsences() {
  await getActor()
  return prisma.attendance.count({
    where: { reviewStatus: 'PENDING', status: { in: ['ABSENT', 'NO_RESPONSE'] } },
  })
}

async function reviewOne(tx: Prisma.TransactionClient, attendanceId: string, action: 'EXCUSE' | 'UNEXCUSE' | 'MARK_PRESENT', note: string | undefined, actorId: string) {
  const context = await tx.attendance.findUnique({ where: { id: attendanceId }, select: { rehearsalId: true, memberId: true } })
  if (!context) throw new AbsenceError('Record not found.')
  await lockRow(tx, 'Rehearsal', context.rehearsalId)
  await lockRow(tx, 'Member', context.memberId)
  const rehearsal = await tx.rehearsal.findUnique({ where: { id: context.rehearsalId } })
  if (action === 'MARK_PRESENT' && rehearsal?.status === 'CANCELLED') throw new AbsenceError('Cancelled rehearsals cannot be marked.')
  if (action === 'MARK_PRESENT') {
    const member = await tx.member.findUnique({ where: { id: context.memberId } })
    if (member?.status !== 'ACTIVE') throw new AbsenceError('Only ACTIVE members can be marked present.')
  }
  const attendance = await tx.attendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, status: true, reviewStatus: true, memberId: true, rehearsalId: true, reason: true },
  })
  if (!attendance) throw new AbsenceError('Record not found.')
  if (attendance.status === 'PRESENT') throw new AbsenceError('Present records cannot be reviewed.')
  if (attendance.reviewStatus !== 'PENDING') throw new AbsenceError('This record has already been reviewed.')
  if (action === 'MARK_PRESENT' && attendance.status !== 'NO_RESPONSE') {
    throw new AbsenceError('Only NO_RESPONSE records can be changed to PRESENT.')
  }

  const newStatus: AttendanceStatus = action === 'MARK_PRESENT' ? 'PRESENT' : attendance.status
  const newReviewStatus: ReviewStatus = action === 'MARK_PRESENT' ? 'NONE' : action === 'EXCUSE' ? 'EXCUSED' : 'UNEXCUSED'

  await tx.attendance.update({
    where: { id: attendanceId },
    data: {
      status: newStatus,
      ...(action === 'MARK_PRESENT' ? { markedBy: 'COMMITTEE' as const, markedAt: new Date() } : {}),
      reviewStatus: newReviewStatus,
      reviewNote: note ?? null,
      reviewedById: actorId,
      reviewedAt: new Date(),
    },
  })

  await tx.auditLog.create({
    data: {
      actorId,
      action: action === 'MARK_PRESENT' ? 'ATTENDANCE_MARKED_PRESENT' : 'ABSENCE_REVIEWED',
      entity: 'Attendance',
      entityId: attendanceId,
      details: { action, reviewStatus: newReviewStatus, note: note ?? null, rehearsalId: attendance.rehearsalId, memberId: attendance.memberId },
    },
  })
}

export async function reviewSingle(attendanceIdInput: unknown, actionInput: unknown, noteInput: unknown) {
  const actor = await getActor()
  const { attendanceId, action, note } = reviewSingleSchema.parse({ attendanceId: attendanceIdInput, action: actionInput, note: noteInput })
  await prisma.$transaction(async (tx) => {
    await reviewOne(tx, attendanceId, action, note, actor.id)
  })
}

export async function reviewBulk(attendanceIdsInput: unknown, actionInput: unknown, noteInput: unknown) {
  const actor = await getActor()
  const { attendanceIds, action, note } = reviewBulkSchema.parse({ attendanceIds: attendanceIdsInput, action: actionInput, note: noteInput })
  await prisma.$transaction(async (tx) => {
    for (const id of [...new Set(attendanceIds)].sort()) {
      await reviewOne(tx, id, action, note, actor.id)
    }
  })
}

export async function getAbsenceStats(filters: AbsenceFilters) {
  await getActor()
  const where = buildWhere(filters)
  const [byStatus, byMonth] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.attendance.groupBy({
      by: ['rehearsalId'],
      where,
      _count: { id: true },
    }),
  ])
  return { byStatus, byMonth }
}

export { isExcused, countsAgainstAnalytics } from './counting'
