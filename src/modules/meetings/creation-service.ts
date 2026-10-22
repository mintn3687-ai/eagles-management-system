import 'server-only'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { meetingsRepository } from './repository'
import type { MeetingCreateInput } from './schema'
import { MeetingServiceError } from './service'

export async function createMeeting(input: MeetingCreateInput, actorId: string) {
  const startsAt = parseNairobiDate(input.meetingDate, input.startTime)
  return meetingsRepository.transaction(async (tx) => {
    const eligible = await meetingsRepository.activeCurrentMembers(tx)
    if (!eligible.length) throw new MeetingServiceError('There are no active members in the current season to create the attendance register.')
    const meeting = await meetingsRepository.createMeeting(tx, {
      title: input.title,
      startsAt,
      venue: input.venue,
      quorumPercent: input.quorumPercent,
      quorumEligibleCount: eligible.length,
      createdById: actorId,
    })
    await meetingsRepository.createAttendanceSnapshot(tx, meeting.id, eligible.map((row) => row.memberId))
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_CREATED',
      entity: 'Meeting',
      entityId: meeting.id,
      details: {
        startsAt: startsAt.toISOString(),
        venue: input.venue,
        quorumPercent: input.quorumPercent,
        eligibleMemberCount: eligible.length,
      },
    })
    return meeting
  })
}
