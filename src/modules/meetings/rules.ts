export type MeetingStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export class MeetingRuleError extends Error {}

export function calculateQuorum(eligibleCount: number, attendedCount: number, quorumPercent: number) {
  const requiredCount = Math.ceil(eligibleCount * quorumPercent / 100)
  return {
    eligibleCount,
    attendedCount,
    requiredCount,
    hasQuorum: eligibleCount > 0 && attendedCount >= requiredCount,
  }
}

export function canTransitionMeeting(from: MeetingStatus, to: MeetingStatus) {
  return (from === 'DRAFT' && ['SCHEDULED', 'CANCELLED'].includes(to))
    || (from === 'SCHEDULED' && ['COMPLETED', 'CANCELLED'].includes(to))
}

export function validateMeetingTransition(from: MeetingStatus, to: MeetingStatus) {
  if (!canTransitionMeeting(from, to)) throw new MeetingRuleError(`A meeting cannot move from ${from.toLowerCase()} to ${to.toLowerCase()}.`)
}

export function validateMinutesApproval(input: {
  status: MeetingStatus
  minutes: string | null
  hasQuorum: boolean
  minutesStatus: 'DRAFT' | 'APPROVED'
}) {
  if (input.minutesStatus === 'APPROVED') throw new MeetingRuleError('These minutes have already been approved.')
  if (input.status !== 'COMPLETED') throw new MeetingRuleError('Complete the meeting before approving its minutes.')
  if (!input.minutes?.trim()) throw new MeetingRuleError('Add the minutes before approving them.')
  if (!input.hasQuorum) throw new MeetingRuleError('Minutes cannot be approved because the meeting did not reach quorum.')
}

export function validateMotionDecision(input: {
  meetingStatus: MeetingStatus
  hasQuorum: boolean
  motionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED'
}) {
  if (input.meetingStatus === 'DRAFT' || input.meetingStatus === 'CANCELLED') {
    throw new MeetingRuleError('A motion can only be decided at a scheduled or completed meeting.')
  }
  if (!input.hasQuorum) throw new MeetingRuleError('A motion cannot be decided because the meeting did not reach quorum.')
  if (input.motionStatus !== 'PENDING') throw new MeetingRuleError('This motion already has a decision.')
}

export function validateActionItemStatusChange(from: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', to: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') {
  if (from === 'COMPLETED' || from === 'CANCELLED') throw new MeetingRuleError(`A ${from.toLowerCase()} action item cannot be changed.`)
  if (from === to) throw new MeetingRuleError('The action item already has this status.')
}
