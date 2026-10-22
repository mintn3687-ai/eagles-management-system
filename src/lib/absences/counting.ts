import type { AttendanceStatus, ReviewStatus } from '@prisma/client'

export type AttendanceAnalyticsClass = 'PRESENT' | 'EXCUSED' | 'MISSED'

/**
 * Shared attendance outcome policy for committee analytics, member statistics,
 * CSVs, and missed-rehearsal details. Database queries supply only CLOSED
 * rehearsals where status history says the member was ACTIVE on the Nairobi
 * rehearsal date and the Nairobi join date is on or before that date. A missing
 * attendance row is treated as an unreviewed NO_RESPONSE.
 */
export function classifyAttendanceForAnalytics(record: {
  status: AttendanceStatus | null
  reviewStatus: ReviewStatus | null
}): AttendanceAnalyticsClass {
  if (record.status === 'PRESENT') return 'PRESENT'
  if ((record.status === 'ABSENT' || record.status === 'NO_RESPONSE' || record.status === null) && record.reviewStatus === 'EXCUSED') return 'EXCUSED'
  return 'MISSED'
}

export function countsAgainstAnalytics(record: { status: AttendanceStatus; reviewStatus: ReviewStatus }): boolean {
  return classifyAttendanceForAnalytics(record) === 'MISSED'
}

export function isExcused(record: { reviewStatus: ReviewStatus }): boolean {
  return classifyAttendanceForAnalytics({ status: 'ABSENT', reviewStatus: record.reviewStatus }) === 'EXCUSED'
}
