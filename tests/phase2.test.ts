import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import {
  calculateQuorum,
  MeetingRuleError,
  validateMeetingTransition,
  validateMinutesApproval,
  validateMotionDecision,
  validateActionItemStatusChange,
} from '../src/modules/meetings/rules'
import {
  actionItemSchema,
  meetingCreateSchema,
  motionDecisionSchema,
} from '../src/modules/meetings/schema'

describe('meeting governance rules', () => {
  it('calculates quorum using a rounded-up threshold and handles no eligible members', () => {
    expect(calculateQuorum(9, 5, 50)).toEqual({
      eligibleCount: 9, attendedCount: 5, requiredCount: 5, hasQuorum: true,
    })
    expect(calculateQuorum(9, 4, 50).hasQuorum).toBe(false)
    expect(calculateQuorum(0, 0, 50)).toEqual({
      eligibleCount: 0, attendedCount: 0, requiredCount: 0, hasQuorum: false,
    })
  })

  it('allows only forward meeting lifecycle transitions', () => {
    expect(() => validateMeetingTransition('DRAFT', 'SCHEDULED')).not.toThrow()
    expect(() => validateMeetingTransition('SCHEDULED', 'COMPLETED')).not.toThrow()
    expect(() => validateMeetingTransition('DRAFT', 'COMPLETED')).toThrow(MeetingRuleError)
    expect(() => validateMeetingTransition('COMPLETED', 'SCHEDULED')).toThrow(MeetingRuleError)
  })

  it('requires a completed quorate meeting and draft content before minutes approval', () => {
    const valid = {
      status: 'COMPLETED' as const, minutes: 'Minutes approved by those present.',
      hasQuorum: true, minutesStatus: 'DRAFT' as const,
    }
    expect(() => validateMinutesApproval(valid)).not.toThrow()
    expect(() => validateMinutesApproval({ ...valid, hasQuorum: false })).toThrow(/did not reach quorum/)
    expect(() => validateMinutesApproval({ ...valid, status: 'SCHEDULED' })).toThrow(/Complete the meeting/)
    expect(() => validateMinutesApproval({ ...valid, minutesStatus: 'APPROVED' })).toThrow(/already been approved/)
  })

  it('requires quorum for a decision and prevents a second decision', () => {
    const valid = { meetingStatus: 'SCHEDULED' as const, hasQuorum: true, motionStatus: 'PENDING' as const }
    expect(() => validateMotionDecision(valid)).not.toThrow()
    expect(() => validateMotionDecision({ ...valid, hasQuorum: false })).toThrow(/did not reach quorum/)
    expect(() => validateMotionDecision({ ...valid, motionStatus: 'APPROVED' })).toThrow(/already has a decision/)
  })

  it('allows progress and completion of open action items, then makes final statuses immutable', () => {
    expect(() => validateActionItemStatusChange('OPEN', 'IN_PROGRESS')).not.toThrow()
    expect(() => validateActionItemStatusChange('IN_PROGRESS', 'COMPLETED')).not.toThrow()
    expect(() => validateActionItemStatusChange('COMPLETED', 'OPEN')).toThrow(/cannot be changed/)
    expect(() => validateActionItemStatusChange('CANCELLED', 'IN_PROGRESS')).toThrow(/cannot be changed/)
    expect(() => validateActionItemStatusChange('OPEN', 'OPEN')).toThrow(/already has this status/)
  })

  it('validates meeting fields and constrains decisions/action-item ownership identifiers', () => {
    const meeting = {
      title: 'Annual meeting',
      meetingDate: '2026-11-01',
      startTime: '18:30',
      venue: 'Drama hall',
      quorumPercent: '50',
    }
    expect(meetingCreateSchema.safeParse(meeting).success).toBe(true)
    expect(meetingCreateSchema.safeParse({ ...meeting, quorumPercent: '0' }).success).toBe(false)
    expect(meetingCreateSchema.safeParse({ ...meeting, meetingDate: '2026-02-30' }).success).toBe(false)
    expect(motionDecisionSchema.safeParse({
      meetingId: 'c123456789012345678901234',
      motionId: 'c123456789012345678901235',
      status: 'APPROVED',
      decisionNote: '',
    }).success).toBe(true)
    expect(actionItemSchema.safeParse({
      meetingId: 'c123456789012345678901234',
      title: 'Submit venue quote',
      description: '',
      ownerMemberId: 'c123456789012345678901235',
      dueDate: '2026-11-30',
    }).success).toBe(true)
  })

  it('grants meeting management only to Committee and Super Admin', () => {
    expect(hasPermission('MEMBER', 'meetings:read')).toBe(true)
    expect(hasPermission('MEMBER', 'meetings:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'meetings:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'meetings:manage')).toBe(true)
  })
})
