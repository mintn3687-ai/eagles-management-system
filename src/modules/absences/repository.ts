import 'server-only'
import { Prisma, type AttendanceStatus, type ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { lockRow } from '@/lib/row-lock'
import { nairobiMonthBounds } from '@/lib/dates'

type Transaction = Prisma.TransactionClient

function parseNairobiMonth(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+03:00`)
}

function buildWhere(filters: {
  rehearsalId?: string
  memberId?: string
  status?: '' | 'ABSENT' | 'NO_RESPONSE'
  month?: string
}): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = {
    reviewStatus: 'PENDING',
    status: { in: ['ABSENT', 'NO_RESPONSE'] },
  }
  if (filters.rehearsalId) where.rehearsalId = filters.rehearsalId
  if (filters.memberId) where.memberId = filters.memberId
  if (filters.status) where.status = filters.status
  if (filters.month) {
    const { start, end } = nairobiMonthBounds(parseNairobiMonth(filters.month))
    where.rehearsal = { date: { gte: start, lt: end } }
  }
  return where
}

export const absencesRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
  list: async (filters: Parameters<typeof buildWhere>[0], page: number) => {
    const where = buildWhere(filters)
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
    return { records, total }
  },
  pendingCount: () => prisma.attendance.count({
    where: { reviewStatus: 'PENDING', status: { in: ['ABSENT', 'NO_RESPONSE'] } },
  }),
  findContext: (tx: Transaction, attendanceId: string) =>
    tx.attendance.findUnique({ where: { id: attendanceId }, select: { rehearsalId: true, memberId: true } }),
  lockRehearsal: (tx: Transaction, rehearsalId: string) => lockRow(tx, 'Rehearsal', rehearsalId),
  lockMember: (tx: Transaction, memberId: string) => lockRow(tx, 'Member', memberId),
  findRehearsalStatus: (tx: Transaction, rehearsalId: string) =>
    tx.rehearsal.findUnique({ where: { id: rehearsalId }, select: { status: true, date: true, endTime: true } }),
  findMemberStatus: (tx: Transaction, memberId: string) =>
    tx.member.findUnique({ where: { id: memberId }, select: { status: true } }),
  findAttendance: (tx: Transaction, attendanceId: string) =>
    tx.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, status: true, reviewStatus: true, memberId: true, rehearsalId: true },
    }),
  updateAttendance: (
    tx: Transaction,
    attendanceId: string,
    data: {
      status: AttendanceStatus
      reviewStatus: ReviewStatus
      markedBy?: 'COMMITTEE'
      markedAt?: Date
      reviewNote: string | null
      reviewedById: string
      reviewedAt: Date
    },
  ) => tx.attendance.update({ where: { id: attendanceId }, data }),
  stats: async (filters: Parameters<typeof buildWhere>[0]) => {
    const where = buildWhere(filters)
    const [byStatus, byMonth] = await Promise.all([
      prisma.attendance.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.attendance.groupBy({ by: ['rehearsalId'], where, _count: { id: true } }),
    ])
    return { byStatus, byMonth }
  },
}
