import 'server-only'
import type { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { syncCurrentSeasonMemberStatus } from '@/modules/seasons/service'
import { attendanceRepository } from './repository'
import { meetsAttendanceSuspensionThresholds, attendanceSuspensionThresholds } from './suspension-rules'

type Transaction = Prisma.TransactionClient

export async function suspendForAttendanceIfEligible(tx: Transaction, memberId: string, actorId: string) {
  const [totalUnexcusedMisses, latestAttendance, member] = await Promise.all([
    attendanceRepository.countConfirmedUnexcusedMisses(tx, memberId),
    attendanceRepository.latestClosedAttendance(tx, memberId),
    attendanceRepository.memberAttendancePolicyContext(tx, memberId),
  ])
  if (!member || member.status !== 'ACTIVE' || member.user?.role === 'SUPER_ADMIN') return false
  if (!meetsAttendanceSuspensionThresholds(totalUnexcusedMisses, latestAttendance)) return false

  const effectiveAt = new Date()
  await attendanceRepository.suspendMember(tx, memberId, effectiveAt)
  await syncCurrentSeasonMemberStatus(tx, memberId, 'SUSPENDED')
  await writeAuditLog(tx, {
    actorId,
    action: 'MEMBER_AUTO_SUSPENDED_FOR_ATTENDANCE',
    entity: 'Member',
    entityId: memberId,
    details: {
      from: 'ACTIVE',
      to: 'SUSPENDED',
      reason: 'Attendance suspension thresholds reached after committee review.',
      trigger: 'ATTENDANCE_POLICY',
      totalUnexcusedMisses,
      consecutiveUnexcusedMisses: attendanceSuspensionThresholds.consecutiveMisses,
      thresholds: attendanceSuspensionThresholds,
    },
  })
  return true
}
