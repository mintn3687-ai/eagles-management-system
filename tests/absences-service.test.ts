import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findContext: vi.fn(),
  lockRehearsal: vi.fn(),
  lockMember: vi.fn(),
  findRehearsalStatus: vi.fn(),
  findMemberStatus: vi.fn(),
  findAttendance: vi.fn(),
  updateAttendance: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/absences/repository', () => ({
  absencesRepository: {
    transaction: mocks.transaction,
    findContext: mocks.findContext,
    lockRehearsal: mocks.lockRehearsal,
    lockMember: mocks.lockMember,
    findRehearsalStatus: mocks.findRehearsalStatus,
    findMemberStatus: mocks.findMemberStatus,
    findAttendance: mocks.findAttendance,
    updateAttendance: mocks.updateAttendance,
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import { reviewSingle } from '../src/modules/absences/service'
import { AbsenceError } from '../src/modules/absences/errors'

describe('absence review service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.findContext.mockResolvedValue({ rehearsalId: 'rehearsal-1', memberId: 'member-1' })
    mocks.findRehearsalStatus.mockResolvedValue({ status: 'CLOSED' })
    mocks.findMemberStatus.mockResolvedValue({ status: 'ACTIVE' })
    mocks.findAttendance.mockResolvedValue({
      id: 'attendance-1', status: 'NO_RESPONSE', reviewStatus: 'PENDING',
      memberId: 'member-1', rehearsalId: 'rehearsal-1',
    })
    mocks.updateAttendance.mockResolvedValue(undefined)
  })

  it('marks a pending no-response record present and audits the correction', async () => {
    await reviewSingle({ attendanceId: 'attendance-1', action: 'MARK_PRESENT', note: 'Verified at rehearsal' }, 'actor-1')
    expect(mocks.updateAttendance).toHaveBeenCalledWith({}, 'attendance-1', expect.objectContaining({
      status: 'PRESENT',
      markedBy: 'COMMITTEE',
      reviewStatus: 'NONE',
      reviewedById: 'actor-1',
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      actorId: 'actor-1',
      action: 'ATTENDANCE_MARKED_PRESENT',
    }))
  })

  it('rejects a cancelled rehearsal before changing attendance', async () => {
    mocks.findRehearsalStatus.mockResolvedValue({ status: 'CANCELLED' })
    await expect(reviewSingle({
      attendanceId: 'attendance-1', action: 'MARK_PRESENT', note: 'Verified at rehearsal',
    }, 'actor-1')).rejects.toBeInstanceOf(AbsenceError)
    expect(mocks.updateAttendance).not.toHaveBeenCalled()
  })
})
