import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const OVERDUE_PAGE_SIZE = 12

const latestSubscription = Prisma.sql`
  WITH latest_subscription AS (
    SELECT DISTINCT ON (p."memberId") p."memberId", COALESCE(p."periodEnd", p."paidAt") AS "periodEnd"
    FROM "Payment" p
    WHERE p."type" = 'SUBSCRIPTION'::"PaymentType" AND p."status" = 'SUCCESS'::"PaymentStatus"
    ORDER BY p."memberId", p."paidAt" DESC NULLS LAST, p."id" DESC
  )
`

export const dashboardRepository = {
  stats: (todayStart: Date, monthStart: Date, monthEnd: Date) => Promise.all([
    prisma.member.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.rehearsal.findFirst({
      where: { status: { in: ['OPEN', 'SCHEDULED'] }, date: { gte: todayStart } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true },
    }),
    prisma.attendance.count({ where: { reviewStatus: 'PENDING', status: { in: ['ABSENT', 'NO_RESPONSE'] } } }),
    prisma.payment.groupBy({
      by: ['type'], where: { status: 'SUCCESS', paidAt: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true }, _count: { _all: true },
    }),
  ]),
  overdueCount: (cutoff: Date) => prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    ${latestSubscription}
    SELECT COUNT(*)::int AS "count"
    FROM "Member" m
    JOIN latest_subscription latest ON latest."memberId" = m."id"
    WHERE m."status" = 'ACTIVE'::"MemberStatus" AND latest."periodEnd" < ${cutoff}
  `),
  overduePage: (cutoff: Date, skip: number) => prisma.$queryRaw<{ id: string; fullName: string; periodEnd: Date }[]>(Prisma.sql`
    ${latestSubscription}
    SELECT m."id", m."fullName", latest."periodEnd"
    FROM "Member" m
    JOIN latest_subscription latest ON latest."memberId" = m."id"
    WHERE m."status" = 'ACTIVE'::"MemberStatus" AND latest."periodEnd" < ${cutoff}
    ORDER BY m."fullName", m."id"
    OFFSET ${skip} LIMIT ${OVERDUE_PAGE_SIZE}
  `),
}
