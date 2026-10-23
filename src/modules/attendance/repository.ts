import 'server-only'
import { Prisma, type AttendanceStatus, type ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'

export type AttendanceBucket = {
  memberId: string
  memberName: string
  monthKey: string
  rehearsalsCounted: number
  status: AttendanceStatus | null
  reviewStatus: ReviewStatus | null
  pairCount: number
}

function monthExpression() {
  return Prisma.sql`TO_CHAR(timezone('Africa/Nairobi', r."date" AT TIME ZONE 'UTC'), 'YYYY-MM')`
}

function activeStatusAtRehearsalSql() {
  return Prisma.sql`
    JOIN LATERAL (
      SELECT h."status"::text AS "status"
      FROM "MemberStatusHistory" h
      WHERE h."memberId" = m."id"
        AND h."effectiveAt" < (
          (timezone('Africa/Nairobi', r."date" AT TIME ZONE 'UTC')::date + 1)::timestamp
          AT TIME ZONE 'Africa/Nairobi'
        )
      ORDER BY h."effectiveAt" DESC, h."recordedAt" DESC, h."id" DESC
      LIMIT 1
    ) membership ON membership."status" = 'ACTIVE'
  `
}

export const attendanceRepository = {
  buckets: async (options: { from: Date; to: Date; memberId?: string }): Promise<AttendanceBucket[]> => {
    const monthKey = monthExpression()
    const memberFilter = options.memberId ? Prisma.sql`AND m."id" = ${options.memberId}` : Prisma.empty
    const activeMembership = activeStatusAtRehearsalSql()
    return prisma.$queryRaw<AttendanceBucket[]>(Prisma.sql`
      WITH eligible_pairs AS (
        SELECT
          m."id" AS "memberId",
          m."fullName" AS "memberName",
          r."id" AS "rehearsalId",
          ${monthKey} AS "monthKey",
          a."status"::text AS "status",
          a."reviewStatus"::text AS "reviewStatus"
        FROM "Member" m
        JOIN "Rehearsal" r
          ON r."status" = 'CLOSED'
          AND r."date" >= ${options.from}
          AND r."date" < ${options.to}
          AND timezone('Africa/Nairobi', m."joinedAt" AT TIME ZONE 'UTC')::date <= timezone('Africa/Nairobi', r."date" AT TIME ZONE 'UTC')::date
        ${activeMembership}
        LEFT JOIN "Attendance" a ON a."rehearsalId" = r."id" AND a."memberId" = m."id"
        WHERE TRUE ${memberFilter}
      ),
      eligible_counts AS (
        SELECT "memberId", "monthKey", COUNT(*)::int AS "rehearsalsCounted"
        FROM eligible_pairs
        GROUP BY "memberId", "monthKey"
      ),
      status_counts AS (
        SELECT "memberId", "memberName", "monthKey", "status", "reviewStatus", COUNT(*)::int AS "pairCount"
        FROM eligible_pairs
        GROUP BY "memberId", "memberName", "monthKey", "status", "reviewStatus"
      )
      SELECT s."memberId", s."memberName", s."monthKey", e."rehearsalsCounted",
        s."status", s."reviewStatus", s."pairCount"
      FROM status_counts s
      JOIN eligible_counts e USING ("memberId", "monthKey")
      ORDER BY s."memberName", s."monthKey"
    `)
  },
  attendanceThresholdValue: () =>
    prisma.setting.findUnique({ where: { key: 'attendanceThreshold' }, select: { value: true } }),
  memberMissedRehearsals: async (memberId: string, start: Date, end: Date) => {
    const activeMembership = activeStatusAtRehearsalSql()
    return prisma.$queryRaw<Array<{
      id: string
      title: string
      date: Date
      status: AttendanceStatus | null
      reviewStatus: ReviewStatus | null
      reason: string | null
    }>>(Prisma.sql`
      SELECT r."id", r."title", r."date", a."status"::text AS "status",
        a."reviewStatus"::text AS "reviewStatus", a."reason"
      FROM "Member" m
      JOIN "Rehearsal" r ON r."status" = 'CLOSED'
        AND r."date" >= ${start} AND r."date" < ${end}
        AND timezone('Africa/Nairobi', m."joinedAt" AT TIME ZONE 'UTC')::date <= timezone('Africa/Nairobi', r."date" AT TIME ZONE 'UTC')::date
      ${activeMembership}
      LEFT JOIN "Attendance" a ON a."rehearsalId" = r."id" AND a."memberId" = m."id"
      WHERE m."id" = ${memberId}
      ORDER BY r."date" DESC, r."id" DESC
    `)
  },
  countClosedRehearsals: (from: Date, to: Date) =>
    prisma.rehearsal.count({ where: { status: 'CLOSED', date: { gte: from, lt: to } } }),
  analyticsMembers: async (start: Date, end: Date) => prisma.$queryRaw<Array<{ id: string; fullName: string }>>(Prisma.sql`
    WITH prior_status AS (
      SELECT h."memberId", h."status", h."effectiveAt", h."recordedAt", h."id"
      FROM "Member" candidate
      JOIN LATERAL (
        SELECT history."memberId", history."status", history."effectiveAt", history."recordedAt", history."id"
        FROM "MemberStatusHistory" history
        WHERE history."memberId" = candidate."id" AND history."effectiveAt" < ${start}
        ORDER BY history."effectiveAt" DESC, history."recordedAt" DESC, history."id" DESC
        LIMIT 1
      ) h ON TRUE
      WHERE timezone('Africa/Nairobi', candidate."joinedAt" AT TIME ZONE 'UTC')::date
        < timezone('Africa/Nairobi', ${end}::timestamp AT TIME ZONE 'UTC')::date
    ),
    month_status AS (
      SELECT "memberId", "status", "effectiveAt", "recordedAt", "id"
      FROM "MemberStatusHistory"
      WHERE "effectiveAt" >= ${start} AND "effectiveAt" < ${end}
    ),
    status_spans AS (
      SELECT "memberId", "status", "effectiveAt",
        LEAD("effectiveAt") OVER (
          PARTITION BY "memberId" ORDER BY "effectiveAt", "recordedAt", "id"
        ) AS "nextEffectiveAt"
      FROM (
        SELECT * FROM prior_status
        UNION ALL
        SELECT * FROM month_status
      ) history_window
    )
    SELECT m."id", m."fullName"
    FROM "Member" m
    WHERE timezone('Africa/Nairobi', m."joinedAt" AT TIME ZONE 'UTC')::date
        < timezone('Africa/Nairobi', ${end}::timestamp AT TIME ZONE 'UTC')::date
      AND EXISTS (
        SELECT 1 FROM status_spans s
        WHERE s."memberId" = m."id" AND s."status" = 'ACTIVE'
          AND s."effectiveAt" < ${end}
          AND (s."nextEffectiveAt" IS NULL OR s."nextEffectiveAt" > ${start})
      )
    ORDER BY m."fullName", m."id"
  `),
}
