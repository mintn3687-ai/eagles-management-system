import { attendancePercent } from '@/lib/attendance-rules'

export type AttendanceMonth = {
  present: number
  excused: number
  missed: number
}

export function summarizeMemberAttendance(months: readonly AttendanceMonth[]) {
  const counts = months.reduce((summary, month) => ({
    present: summary.present + month.present,
    excused: summary.excused + month.excused,
    missed: summary.missed + month.missed,
  }), { present: 0, excused: 0, missed: 0 })
  return {
    ...counts,
    total: counts.present + counts.excused + counts.missed,
    percent: attendancePercent(counts.present, counts.missed),
  }
}
