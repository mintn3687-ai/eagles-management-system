import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  activeCurrentMembers: vi.fn(),
  createMeeting: vi.fn(),
  createAttendanceSnapshot: vi.fn(),
  findMeeting: vi.fn(),
  updateStatus: vi.fn(),
  approveMinutes: vi.fn(),
  findMotion: vi.fn(),
  decideMotion: vi.fn(),
  writeAuditLog: vi.fn(),
  lockRow: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/meetings/repository', () => ({
  meetingsRepository: {
    transaction: mocks.transaction,
    activeCurrentMembers: mocks.activeCurrentMembers,
    createMeeting: mocks.createMeeting,
    createAttendanceSnapshot: mocks.createAttendanceSnapshot,
    findMeeting: mocks.findMeeting,
    updateStatus: mocks.updateStatus,
    approveMinutes: mocks.approveMinutes,
    findMotion: mocks.findMotion,
    decideMotion: mocks.decideMotion,
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))

import {
  approveMeetingMinutes,
  decideMotion,
  transitionMeeting,
} from '../src/modules/meetings/service'
import { MeetingServiceError } from '../src/modules/meetings/service'
import { createMeeting } from '../src/modules/meetings/creation-service'

const meeting = {
  id: 'c123456789012345678901234',
  status: 'COMPLETED',
  minutesStatus: 'DRAFT',
  minutes: 'The meeting reviewed the production schedule.',
  quorumPercent: 50,
  quorumEligibleCount: 4,
  attendances: [{ attended: true }, { attended: true }, { attended: false }, { attended: false }],
}

describe('meeting service workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.activeCurrentMembers.mockResolvedValue([
      { memberId: 'member-a', member: { fullName: 'A Member' } },
      { memberId: 'member-b', member: { fullName: 'B Member' } },
    ])
    mocks.createMeeting.mockResolvedValue({ id: meeting.id, title: 'Annual meeting' })
    mocks.findMeeting.mockResolvedValue(meeting)
    mocks.updateStatus.mockResolvedValue(undefined)
    mocks.approveMinutes.mockResolvedValue(undefined)
    mocks.findMotion.mockResolvedValue({ id: 'motion-id', status: 'PENDING' })
    mocks.decideMotion.mockResolvedValue(undefined)
  })

  it('freezes active current-season members at creation and audits the snapshot', async () => {
    await createMeeting({
      title: 'Annual meeting',
      meetingDate: '2026-11-01',
      startTime: '18:30',
      venue: 'Drama hall',
      quorumPercent: 60,
    }, 'admin-id')

    expect(mocks.createMeeting).toHaveBeenCalledWith({}, expect.objectContaining({
      quorumPercent: 60,
      quorumEligibleCount: 2,
    }))
    expect(mocks.createAttendanceSnapshot).toHaveBeenCalledWith({}, meeting.id, ['member-a', 'member-b'])
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'MEETING_CREATED',
      details: expect.objectContaining({ eligibleMemberCount: 2 }),
    }))
  })

  it('does not create a meeting without an active current-season attendance register', async () => {
    mocks.activeCurrentMembers.mockResolvedValue([])
    await expect(createMeeting({
      title: 'Annual meeting',
      meetingDate: '2026-11-01',
      startTime: '18:30',
      venue: 'Drama hall',
      quorumPercent: 60,
    }, 'admin-id')).rejects.toThrow(/no active members/)
    expect(mocks.createMeeting).not.toHaveBeenCalled()
  })

  it('rejects an invalid transition before writing changes', async () => {
    mocks.findMeeting.mockResolvedValue({ ...meeting, status: 'DRAFT' })
    await expect(transitionMeeting(meeting.id, 'COMPLETED', 'admin-id')).rejects.toBeInstanceOf(MeetingServiceError)
    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it('approves minutes only after quorum checks and audits the approval', async () => {
    await approveMeetingMinutes(meeting.id, 'admin-id')
    expect(mocks.approveMinutes).toHaveBeenCalledWith({}, meeting.id, 'admin-id', expect.any(Date))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'MEETING_MINUTES_APPROVED',
    }))

    mocks.findMeeting.mockResolvedValue({
      ...meeting,
      attendances: [{ attended: true }, { attended: false }, { attended: false }, { attended: false }],
    })
    await expect(approveMeetingMinutes(meeting.id, 'admin-id')).rejects.toThrow(/did not reach quorum/)
  })

  it('locks and records a quorum-backed motion decision once', async () => {
    await decideMotion(meeting.id, 'motion-id', { status: 'APPROVED', decisionNote: 'Carried.' }, 'admin-id')
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'Motion', 'motion-id')
    expect(mocks.decideMotion).toHaveBeenCalledWith({}, 'motion-id', expect.objectContaining({
      status: 'APPROVED',
      decidedById: 'admin-id',
    }))

    mocks.findMotion.mockResolvedValue({ id: 'motion-id', status: 'APPROVED' })
    await expect(decideMotion(meeting.id, 'motion-id', { status: 'REJECTED', decisionNote: '' }, 'admin-id'))
      .rejects.toThrow(/already has a decision/)
  })
})
