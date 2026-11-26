import type { AttendanceStatus, ReviewStatus } from '@prisma/client'

export const attendanceSuspensionThresholds = {
  consecutiveMisses: 4,
  totalMisses: 5,
} as const

export function meetsAttendanceSuspensionThresholds(
  totalUnexcusedMisses: number,
  latestAttendance: Array<{ status: AttendanceStatus; reviewStatus: ReviewStatus }>,
) {
  const consecutiveMisses = latestAttendance.slice(0, attendanceSuspensionThresholds.consecutiveMisses)
  return totalUnexcusedMisses >= attendanceSuspensionThresholds.totalMisses
    && consecutiveMisses.length === attendanceSuspensionThresholds.consecutiveMisses
    && consecutiveMisses.every((record) =>
      record.status !== 'PRESENT' && record.reviewStatus === 'UNEXCUSED')
}
