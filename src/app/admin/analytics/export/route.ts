import { currentNairobiMonth, getMonthlyAttendance, listAnalyticsMembers, attendancePercent } from '@/lib/attendance-analytics'
import { requireRole } from '@/lib/permissions'
import { analyticsMonthSchema } from '@/lib/validation/analytics'

function csvCell(value: string | number) {
  let text = String(value)
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  await requireRole('COMMITTEE')
  const monthParam = new URL(request.url).searchParams.get('month')
  const parsed = analyticsMonthSchema.safeParse(monthParam ?? currentNairobiMonth())
  const month = parsed.success && parsed.data <= currentNairobiMonth() ? parsed.data : null
  if (!month) return new Response('Choose a valid Nairobi month.', { status: 400 })

  const [stats, members] = await Promise.all([getMonthlyAttendance(month), listAnalyticsMembers(month)])
  const byMember = new Map(stats.map((row) => [row.memberId, row]))
  const rows = [
    ['Member', 'Month', 'Rehearsals counted', 'Present', 'Excused', 'Unexcused / missed', 'Attendance %'],
    ...members.map((member) => {
      const row = byMember.get(member.id)
      const present = row?.present ?? 0
      const missed = row?.missed ?? 0
      return [member.fullName, month, row?.rehearsalsCounted ?? 0, present, row?.excused ?? 0, missed, `${attendancePercent(present, missed).toFixed(1)}%`]
    }),
  ]
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
