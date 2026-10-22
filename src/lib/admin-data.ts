import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getGraceDays } from '@/lib/fees'
import { nairobiDateKey, nairobiMonthBounds, parseNairobiDate } from '@/lib/dates'

const OVERDUE_PAGE_SIZE = 12

export async function getDashboardData(requestedOverduePage = 1) {
  const today = nairobiDateKey()
  const todayStart = parseNairobiDate(today)
  const { start, end } = nairobiMonthBounds()
  const [membersByStatus, nextRehearsal, pendingAbsences, paymentTotals, graceDays] = await Promise.all([
    prisma.member.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.rehearsal.findFirst({
      where: { status: { in: ['OPEN', 'SCHEDULED'] }, date: { gte: todayStart } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true },
    }),
    prisma.attendance.count({ where: { reviewStatus: 'PENDING', status: { in: ['ABSENT', 'NO_RESPONSE'] } } }),
    prisma.payment.groupBy({
      by: ['type'], where: { status: 'SUCCESS', paidAt: { gte: start, lt: end } },
      _sum: { amount: true }, _count: { _all: true },
    }),
    getGraceDays(),
  ])
  const cutoff = new Date(Date.now() - graceDays * 86400000)
  const pageQuery = (skip: number) => Prisma.sql`
    WITH latest_subscription AS (
      SELECT DISTINCT ON (p."memberId") p."memberId", COALESCE(p."periodEnd", p."paidAt") AS "periodEnd"
      FROM "Payment" p
      WHERE p."type" = 'SUBSCRIPTION'::"PaymentType" AND p."status" = 'SUCCESS'::"PaymentStatus"
      ORDER BY p."memberId", p."paidAt" DESC NULLS LAST, p."id" DESC
    )
    SELECT m."id", m."fullName", latest."periodEnd"
    FROM "Member" m
    JOIN latest_subscription latest ON latest."memberId" = m."id"
    WHERE m."status" = 'ACTIVE'::"MemberStatus" AND latest."periodEnd" < ${cutoff}
    ORDER BY m."fullName", m."id"
    OFFSET ${skip} LIMIT ${OVERDUE_PAGE_SIZE}
  `
  const countQuery = Prisma.sql`
    WITH latest_subscription AS (
      SELECT DISTINCT ON (p."memberId") p."memberId", COALESCE(p."periodEnd", p."paidAt") AS "periodEnd"
      FROM "Payment" p
      WHERE p."type" = 'SUBSCRIPTION'::"PaymentType" AND p."status" = 'SUCCESS'::"PaymentStatus"
      ORDER BY p."memberId", p."paidAt" DESC NULLS LAST, p."id" DESC
    )
    SELECT COUNT(*)::int AS "count"
    FROM "Member" m
    JOIN latest_subscription latest ON latest."memberId" = m."id"
    WHERE m."status" = 'ACTIVE'::"MemberStatus" AND latest."periodEnd" < ${cutoff}
  `
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>(countQuery)
  const overduePageCount = Math.max(1, Math.ceil(count / OVERDUE_PAGE_SIZE))
  const overduePage = Math.min(requestedOverduePage, overduePageCount)
  const overdueSubscriptions = await prisma.$queryRaw<{ id: string; fullName: string; periodEnd: Date }[]>(pageQuery((overduePage - 1) * OVERDUE_PAGE_SIZE))
  const totals = {
    REGISTRATION: { amount: 0, count: 0 },
    SUBSCRIPTION: { amount: 0, count: 0 },
  }
  for (const row of paymentTotals) {
    totals[row.type] = { amount: row._sum.amount ?? 0, count: row._count._all }
  }
  return { membersByStatus, nextRehearsal, pendingAbsences, totals, overdueSubscriptions, overdueTotal: count, overduePage, overduePageCount }
}
