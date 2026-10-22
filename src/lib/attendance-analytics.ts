import 'server-only'
import { unstable_cache } from 'next/cache'
import { Prisma, type AttendanceStatus, type ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { classifyAttendanceForAnalytics, type AttendanceAnalyticsClass } from '@/lib/absences/counting'
import { attendancePercent } from '@/lib/attendance-rules'
export { attendancePercent } from '@/lib/attendance-rules'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'

type AttendanceBucket = {
  memberId: string
  memberName: string
  monthKey: string
  rehearsalsCounted: number
  status: AttendanceStatus | null
  reviewStatus: ReviewStatus | null
  pairCount: number
}

export type MemberAttendanceStats = {
  memberId: string
  memberName: string
  month: string
  rehearsalsCounted: number
  present: number
  excused: number
  missed: number
}

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const start = parseNairobiDate(`${monthKey}-01`)
  const nextMonth = new Date(Date.UTC(year, month, 1))
  const nextKey = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`
  return { start, end: parseNairobiDate(`${nextKey}-01`) }
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

async function queryAttendanceBuckets(options: {
  from: Date
  to: Date
  memberId?: string
}): Promise<AttendanceBucket[]> {
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
}

function summarizeBuckets(buckets: AttendanceBucket[]): MemberAttendanceStats[] {
  const members = new Map<string, MemberAttendanceStats>()
  for (const bucket of buckets) {
    const month = bucket.monthKey
    const key = `${bucket.memberId}:${month}`
    let stats = members.get(key)
    if (!stats) {
      stats = {
        memberId: bucket.memberId,
        memberName: bucket.memberName,
        month,
        rehearsalsCounted: bucket.rehearsalsCounted,
        present: 0,
        excused: 0,
        missed: 0,
      }
      members.set(key, stats)
    }

    const classification: AttendanceAnalyticsClass = classifyAttendanceForAnalytics({
      status: bucket.status,
      reviewStatus: bucket.reviewStatus,
    })
    stats[classification === 'PRESENT' ? 'present' : classification === 'EXCUSED' ? 'excused' : 'missed'] += bucket.pairCount
  }
  return [...members.values()]
}

const cachedMonthlyBuckets = unstable_cache(
  async (monthKey: string, memberId: string) => {
    const { start, end } = monthBounds(monthKey)
    return queryAttendanceBuckets({ from: start, to: end, ...(memberId ? { memberId } : {}) })
  },
  ['attendance-analytics-month-v2'],
  { revalidate: 3600 },
)

const cachedTrendBuckets = unstable_cache(
  async (fromMonth: string, toMonth: string) => {
    const { start } = monthBounds(fromMonth)
    const { end } = monthBounds(toMonth)
    return queryAttendanceBuckets({ from: start, to: end })
  },
  ['attendance-analytics-trend-v1'],
  { revalidate: 3600 },
)

const cachedMemberHistoryBuckets = unstable_cache(
  async (memberId: string, fromMonth: string, toMonth: string) => {
    const { start } = monthBounds(fromMonth)
    const { start: end } = monthBounds(toMonth)
    return queryAttendanceBuckets({ from: start, to: end, memberId })
  },
  ['attendance-analytics-member-history-v2'],
  { revalidate: 3600 },
)

export function getMonthRange(monthKey: string) {
  return monthBounds(monthKey)
}

export function currentNairobiMonth() {
  return nairobiDateKey().slice(0, 7)
}

export function shiftMonth(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatAnalyticsMonth(monthKey: string): string {
  return new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' })
    .format(parseNairobiDate(`${monthKey}-01`))
}

export async function getMonthlyAttendance(monthKey: string, memberId?: string): Promise<MemberAttendanceStats[]> {
  const bounds = monthBounds(monthKey)
  const buckets = monthKey < currentNairobiMonth()
    ? await cachedMonthlyBuckets(monthKey, memberId ?? '')
    : await queryAttendanceBuckets({ from: bounds.start, to: bounds.end, ...(memberId ? { memberId } : {}) })
  return summarizeBuckets(buckets)
}

export async function getAttendanceTrend(endMonth: string): Promise<Array<{ month: string; percent: number }>> {
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(endMonth, index - 5))
  const currentMonth = currentNairobiMonth()
  let buckets: AttendanceBucket[]

  if (endMonth < currentMonth) {
    buckets = await cachedTrendBuckets(months[0], endMonth)
  } else {
    const liveStart = monthBounds(currentMonth).start
    const pastToMonth = shiftMonth(currentMonth, -1)
    const [pastBuckets, liveBuckets] = await Promise.all([
      months[0] < currentMonth ? cachedTrendBuckets(months[0], pastToMonth) : Promise.resolve([]),
      queryAttendanceBuckets({ from: liveStart, to: monthBounds(currentMonth).end }),
    ])
    buckets = [...pastBuckets, ...liveBuckets]
  }

  const totals = new Map<string, { present: number; missed: number }>()
  for (const row of summarizeBuckets(buckets)) {
    const total = totals.get(row.month) ?? { present: 0, missed: 0 }
    total.present += row.present
    total.missed += row.missed
    totals.set(row.month, total)
  }
  return months.map((month) => {
    const total = totals.get(month) ?? { present: 0, missed: 0 }
    return { month, percent: attendancePercent(total.present, total.missed) }
  })
}

export async function getAttendanceThreshold(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'attendanceThreshold' }, select: { value: true } })
  const value = setting?.value
  const threshold = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 60
  return Number.isFinite(threshold) && threshold >= 0 && threshold <= 100 ? threshold : 60
}

export async function getMemberAttendanceHistory(memberId: string, joinedAt: Date): Promise<MemberAttendanceStats[]> {
  const currentMonth = currentNairobiMonth()
  const fromMonth = nairobiDateKey(joinedAt).slice(0, 7)
  const past = fromMonth < currentMonth ? await cachedMemberHistoryBuckets(memberId, fromMonth, currentMonth) : []
  const currentBounds = monthBounds(currentMonth)
  const current = await queryAttendanceBuckets({ from: currentBounds.start, to: currentBounds.end, memberId })
  const byMonth = new Map(summarizeBuckets([...past, ...current]).map((item) => [item.month, item]))
  const monthCount = (Number(currentMonth.slice(0, 4)) - Number(fromMonth.slice(0, 4))) * 12
    + Number(currentMonth.slice(5, 7)) - Number(fromMonth.slice(5, 7)) + 1

  return Array.from({ length: monthCount }, (_, index) => shiftMonth(fromMonth, index)).map((month) => byMonth.get(month) ?? {
    memberId,
    memberName: '',
    month,
    rehearsalsCounted: 0,
    present: 0,
    excused: 0,
    missed: 0,
  })
}

async function queryMemberMissedRehearsals(memberId: string, monthKey: string) {
  const { start, end } = monthBounds(monthKey)
  const activeMembership = activeStatusAtRehearsalSql()
  const rows = await prisma.$queryRaw<Array<{
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
  return rows.filter((row) => classifyAttendanceForAnalytics(row) === 'MISSED')
}

const cachedMemberMissedRehearsals = unstable_cache(
  queryMemberMissedRehearsals,
  ['attendance-analytics-member-missed-v2'],
  { revalidate: 3600 },
)

export async function getMemberMissedRehearsals(memberId: string, monthKey: string) {
  return monthKey < currentNairobiMonth()
    ? cachedMemberMissedRehearsals(memberId, monthKey)
    : queryMemberMissedRehearsals(memberId, monthKey)
}

export async function countClosedRehearsals(from: Date, to: Date): Promise<number> {
  return prisma.rehearsal.count({ where: { status: 'CLOSED', date: { gte: from, lt: to } } })
}

export async function listAnalyticsMembers(monthKey: string) {
  const { start, end } = monthBounds(monthKey)
  return prisma.$queryRaw<Array<{ id: string; fullName: string }>>(Prisma.sql`
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
  `)
}
