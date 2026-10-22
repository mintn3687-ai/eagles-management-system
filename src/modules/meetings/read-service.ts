import 'server-only'
import { meetingsRepository } from './repository'
import { calculateQuorum } from './rules'

export async function listMeetings() {
  const rows = await meetingsRepository.listMeetings()
  return rows.map((meeting) => ({
    ...meeting,
    quorum: calculateQuorum(
      meeting.quorumEligibleCount,
      meeting.attendances.length,
      meeting.quorumPercent,
    ),
  }))
}

export async function getMeetingDetail(meetingId: string) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await meetingsRepository.findMeeting(tx, meetingId)
    if (!meeting) return null
    const attendedCount = meeting.attendances.filter((attendance) => attendance.attended).length
    return {
      ...meeting,
      quorum: calculateQuorum(meeting.quorumEligibleCount, attendedCount, meeting.quorumPercent),
    }
  })
}

export async function getMemberGovernance(memberId: string | null) {
  if (!memberId) return { minutes: [], actionItems: [] }
  const [minutes, actionItems] = await meetingsRepository.memberGovernance(memberId)
  return { minutes, actionItems }
}
