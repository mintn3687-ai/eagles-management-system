import 'server-only'
import { getMemberAttendanceHistory } from '@/lib/attendance-analytics'
import { summarizeMemberAttendance } from './rules'
import { memberDetailsRepository } from './repository'

export async function getMemberInviteTarget(memberId: string) {
  return memberDetailsRepository.inviteTarget(memberId)
}

export async function getMemberDetail(memberId: string) {
  const member = await memberDetailsRepository.findById(memberId)
  if (!member) return null

  const history = await getMemberAttendanceHistory(member.id, member.joinedAt)
  const attendance = summarizeMemberAttendance(history)
  const currentMembership = member.seasonMemberships[0] ?? null

  return {
    ...member,
    attendances: member.rehearsals,
    attendance,
    currentMembership,
  }
}
