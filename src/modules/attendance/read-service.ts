import 'server-only'
import { unstable_cache } from 'next/cache'
import { classifyAttendanceForAnalytics, type AttendanceAnalyticsClass } from '@/lib/absences/counting'
import { attendancePercent } from '@/lib/attendance-rules'
export { attendancePercent } from '@/lib/attendance-rules'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { attendanceRepository, type AttendanceBucket } from './repository'

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
    return attendanceRepository.buckets({ from: start, to: end, ...(memberId ? { memberId } : {}) })
  },
  ['attendance-analytics-month-v2'],
  { revalidate: 3600 },
)

const cachedTrendBuckets = unstable_cache(
  async (fromMonth: string, toMonth: string) => {
    const { start } = monthBounds(fromMonth)
    const { end } = monthBounds(toMonth)
    return attendanceRepository.buckets({ from: start, to: end })
  },
  ['attendance-analytics-trend-v1'],
  { revalidate: 3600 },
)

const cachedMemberHistoryBuckets = unstable_cache(
  async (memberId: string, fromMonth: string, toMonth: string) => {
    const { start } = monthBounds(fromMonth)
    const { start: end } = monthBounds(toMonth)
    return attendanceRepository.buckets({ from: start, to: end, memberId })
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
    : await attendanceRepository.buckets({ from: bounds.start, to: bounds.end, ...(memberId ? { memberId } : {}) })
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
      attendanceRepository.buckets({ from: liveStart, to: monthBounds(currentMonth).end }),
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
  const setting = await attendanceRepository.attendanceThresholdValue()
  const value = setting?.value
  const threshold = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 60
  return Number.isFinite(threshold) && threshold >= 0 && threshold <= 100 ? threshold : 60
}

export async function getMemberAttendanceHistory(memberId: string, joinedAt: Date): Promise<MemberAttendanceStats[]> {
  const currentMonth = currentNairobiMonth()
  const fromMonth = nairobiDateKey(joinedAt).slice(0, 7)
  const past = fromMonth < currentMonth ? await cachedMemberHistoryBuckets(memberId, fromMonth, currentMonth) : []
  const currentBounds = monthBounds(currentMonth)
  const current = await attendanceRepository.buckets({ from: currentBounds.start, to: currentBounds.end, memberId })
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
  const rows = await attendanceRepository.memberMissedRehearsals(memberId, start, end)
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
  return attendanceRepository.countClosedRehearsals(from, to)
}

export async function listAnalyticsMembers(monthKey: string) {
  const { start, end } = monthBounds(monthKey)
  return attendanceRepository.analyticsMembers(start, end)
}
