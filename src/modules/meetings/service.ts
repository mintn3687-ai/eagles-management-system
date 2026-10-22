import 'server-only'
import type { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { lockRow } from '@/lib/row-lock'
import { meetingsRepository } from './repository'
import {
  calculateQuorum,
  MeetingRuleError,
  validateMeetingTransition,
  validateMinutesApproval,
  validateMotionDecision,
  validateActionItemStatusChange,
} from './rules'

export class MeetingServiceError extends Error {}

function toQuorum(meeting: {
  quorumEligibleCount: number
  quorumPercent: number
  attendances: Array<{ attended: boolean }>
}) {
  const attendedCount = meeting.attendances.filter((attendance) => attendance.attended).length
  return calculateQuorum(meeting.quorumEligibleCount, attendedCount, meeting.quorumPercent)
}

function mapRuleError(error: unknown): never {
  if (error instanceof MeetingRuleError) throw new MeetingServiceError(error.message)
  throw error
}

async function loadMeetingForUpdate(tx: Prisma.TransactionClient, meetingId: string) {
  await lockRow(tx, 'Meeting', meetingId)
  const meeting = await meetingsRepository.findMeeting(tx, meetingId)
  if (!meeting) throw new MeetingServiceError('Meeting not found.')
  return meeting
}

export async function transitionMeeting(
  meetingId: string,
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
  actorId: string,
) {
  try {
    return await meetingsRepository.transaction(async (tx) => {
      const meeting = await loadMeetingForUpdate(tx, meetingId)
      validateMeetingTransition(meeting.status, status)
      if (meeting.minutesStatus === 'APPROVED') throw new MeetingServiceError('An approved meeting record cannot be changed.')
      await meetingsRepository.updateStatus(tx, meetingId, status)
      const quorum = toQuorum(meeting)
      await writeAuditLog(tx, {
        actorId,
        action: 'MEETING_STATUS_CHANGED',
        entity: 'Meeting',
        entityId: meetingId,
        details: { from: meeting.status, to: status, quorum },
      })
      return status
    })
  } catch (error) {
    mapRuleError(error)
  }
}

export async function addAgendaItem(
  meetingId: string,
  input: { title: string; description: string },
  actorId: string,
) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await loadMeetingForUpdate(tx, meetingId)
    if (meeting.status === 'CANCELLED' || meeting.minutesStatus === 'APPROVED') {
      throw new MeetingServiceError('Agenda items cannot be changed on a cancelled meeting or after minutes are approved.')
    }
    const item = await meetingsRepository.createAgendaItem(tx, meetingId, input)
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_AGENDA_ITEM_ADDED',
      entity: 'MeetingAgendaItem',
      entityId: item.id,
      details: { meetingId, title: input.title },
    })
    return item
  })
}

export async function updateMeetingAttendance(
  meetingId: string,
  presentMemberIds: string[],
  actorId: string,
) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await loadMeetingForUpdate(tx, meetingId)
    if (meeting.status === 'DRAFT' || meeting.status === 'CANCELLED' || meeting.minutesStatus === 'APPROVED') {
      throw new MeetingServiceError('Attendance can only be edited while a meeting is scheduled or completed and its minutes are unapproved.')
    }
    const eligibleIds = new Set(meeting.attendances.map((item) => item.memberId))
    if (presentMemberIds.some((memberId) => !eligibleIds.has(memberId))) {
      throw new MeetingServiceError('Attendance includes a member outside the meeting’s frozen eligibility list.')
    }
    for (const attendance of meeting.attendances) {
      await meetingsRepository.setAttendance(tx, meetingId, attendance.memberId, presentMemberIds.includes(attendance.memberId))
    }
    const quorum = calculateQuorum(meeting.quorumEligibleCount, presentMemberIds.length, meeting.quorumPercent)
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_ATTENDANCE_UPDATED',
      entity: 'Meeting',
      entityId: meetingId,
      details: { attendedCount: presentMemberIds.length, eligibleCount: meeting.quorumEligibleCount, quorum },
    })
    return quorum
  })
}

export async function saveMeetingMinutes(meetingId: string, minutes: string, actorId: string) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await loadMeetingForUpdate(tx, meetingId)
    if (meeting.status !== 'COMPLETED') throw new MeetingServiceError('Complete the meeting before saving its minutes.')
    if (meeting.minutesStatus === 'APPROVED') throw new MeetingServiceError('Approved minutes are locked and cannot be changed.')
    await meetingsRepository.saveMinutes(tx, meetingId, minutes)
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_MINUTES_SAVED',
      entity: 'Meeting',
      entityId: meetingId,
      details: { characterCount: minutes.length },
    })
  })
}

export async function approveMeetingMinutes(meetingId: string, actorId: string) {
  try {
    return await meetingsRepository.transaction(async (tx) => {
      const meeting = await loadMeetingForUpdate(tx, meetingId)
      const quorum = toQuorum(meeting)
      validateMinutesApproval({
        status: meeting.status,
        minutes: meeting.minutes,
        hasQuorum: quorum.hasQuorum,
        minutesStatus: meeting.minutesStatus,
      })
      const approvedAt = new Date()
      await meetingsRepository.approveMinutes(tx, meetingId, actorId, approvedAt)
      await writeAuditLog(tx, {
        actorId,
        action: 'MEETING_MINUTES_APPROVED',
        entity: 'Meeting',
        entityId: meetingId,
        details: { quorum, approvedAt: approvedAt.toISOString() },
      })
      return { approvedAt, quorum }
    })
  } catch (error) {
    mapRuleError(error)
  }
}

export async function addMotion(
  meetingId: string,
  input: { title: string; description: string },
  actorId: string,
) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await loadMeetingForUpdate(tx, meetingId)
    if (meeting.status === 'DRAFT' || meeting.status === 'CANCELLED' || meeting.minutesStatus === 'APPROVED') {
      throw new MeetingServiceError('Motions can only be added to a scheduled or completed meeting with unapproved minutes.')
    }
    const motion = await meetingsRepository.createMotion(tx, meetingId, input)
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_MOTION_CREATED',
      entity: 'Motion',
      entityId: motion.id,
      details: { meetingId, title: input.title },
    })
    return motion
  })
}

export async function decideMotion(
  meetingId: string,
  motionId: string,
  input: { status: 'APPROVED' | 'REJECTED' | 'DEFERRED'; decisionNote: string },
  actorId: string,
) {
  try {
    return await meetingsRepository.transaction(async (tx) => {
      const meeting = await loadMeetingForUpdate(tx, meetingId)
      const motion = await meetingsRepository.findMotion(tx, meetingId, motionId)
      if (!motion) throw new MeetingServiceError('Motion not found.')
      await lockRow(tx, 'Motion', motionId)
      const lockedMotion = await meetingsRepository.findMotion(tx, meetingId, motionId)
      if (!lockedMotion) throw new MeetingServiceError('Motion not found.')
      const quorum = toQuorum(meeting)
      validateMotionDecision({ meetingStatus: meeting.status, hasQuorum: quorum.hasQuorum, motionStatus: lockedMotion.status })
      const decidedAt = new Date()
      await meetingsRepository.decideMotion(tx, motionId, {
        ...input,
        decidedById: actorId,
        decidedAt,
      })
      await writeAuditLog(tx, {
        actorId,
        action: 'MEETING_MOTION_DECIDED',
        entity: 'Motion',
        entityId: motionId,
        details: { meetingId, status: input.status, decisionNote: input.decisionNote, quorum },
      })
      return input.status
    })
  } catch (error) {
    mapRuleError(error)
  }
}

export async function addMeetingActionItem(
  meetingId: string,
  input: { title: string; description: string; ownerMemberId: string; dueDate: string },
  actorId: string,
) {
  return meetingsRepository.transaction(async (tx) => {
    const meeting = await loadMeetingForUpdate(tx, meetingId)
    if (meeting.status === 'CANCELLED' || meeting.minutesStatus === 'APPROVED') {
      throw new MeetingServiceError('Action items cannot be added to a cancelled meeting or after minutes are approved.')
    }
    if (!await meetingsRepository.hasMeetingMember(tx, meetingId, input.ownerMemberId)) {
      throw new MeetingServiceError('Choose an action-item owner from this meeting’s frozen member list.')
    }
    const dueAt = input.dueDate ? parseNairobiDate(input.dueDate) : null
    const item = await meetingsRepository.createActionItem(tx, {
      meetingId,
      title: input.title,
      description: input.description,
      ownerMemberId: input.ownerMemberId,
      dueAt,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'MEETING_ACTION_ITEM_CREATED',
      entity: 'MeetingActionItem',
      entityId: item.id,
      details: { meetingId, ownerMemberId: input.ownerMemberId, dueAt: dueAt?.toISOString() ?? null },
    })
    return item
  })
}

export async function updateMeetingActionItemStatus(
  meetingId: string,
  actionItemId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  actorId: string,
) {
  try {
    return await meetingsRepository.transaction(async (tx) => {
      await loadMeetingForUpdate(tx, meetingId)
      const item = await meetingsRepository.findActionItem(tx, meetingId, actionItemId)
      if (!item) throw new MeetingServiceError('Action item not found.')
      validateActionItemStatusChange(item.status, status)
      await meetingsRepository.updateActionItemStatus(tx, actionItemId, status)
      await writeAuditLog(tx, {
        actorId,
        action: 'MEETING_ACTION_ITEM_STATUS_CHANGED',
        entity: 'MeetingActionItem',
        entityId: actionItemId,
        details: { meetingId, from: item.status, to: status },
      })
      return status
    })
  } catch (error) {
    mapRuleError(error)
  }
}
