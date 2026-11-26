import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  countConfirmedUnexcusedMisses: vi.fn(),
  latestClosedAttendance: vi.fn(),
  memberAttendancePolicyContext: vi.fn(),
  suspendMember: vi.fn(),
  syncCurrentSeasonMemberStatus: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/attendance/repository', () => ({
  attendanceRepository: {
    countConfirmedUnexcusedMisses: mocks.countConfirmedUnexcusedMisses,
    latestClosedAttendance: mocks.latestClosedAttendance,
    memberAttendancePolicyContext: mocks.memberAttendancePolicyContext,
    suspendMember: mocks.suspendMember,
  },
}))
vi.mock('@/modules/seasons/service', () => ({
  syncCurrentSeasonMemberStatus: mocks.syncCurrentSeasonMemberStatus,
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import { suspendForAttendanceIfEligible } from '../src/modules/attendance/service'

const transaction = {} as Prisma.TransactionClient

describe('attendance-triggered suspension service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.countConfirmedUnexcusedMisses.mockResolvedValue(5)
    mocks.latestClosedAttendance.mockResolvedValue(Array.from({ length: 4 }, () => ({
      id: 'attendance-id',
      status: 'ABSENT',
      reviewStatus: 'UNEXCUSED',
      rehearsalId: 'rehearsal-id',
    })))
    mocks.memberAttendancePolicyContext.mockResolvedValue({ status: 'ACTIVE', user: { role: 'MEMBER' } })
  })

  it('suspends an eligible active member and records season status and audit history', async () => {
    const suspended = await suspendForAttendanceIfEligible(transaction, 'member-id', 'committee-id')

    expect(suspended).toBe(true)
    expect(mocks.suspendMember).toHaveBeenCalledWith(transaction, 'member-id', expect.any(Date))
    expect(mocks.syncCurrentSeasonMemberStatus).toHaveBeenCalledWith(transaction, 'member-id', 'SUSPENDED')
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, expect.objectContaining({
      actorId: 'committee-id',
      action: 'MEMBER_AUTO_SUSPENDED_FOR_ATTENDANCE',
      entityId: 'member-id',
      details: expect.objectContaining({ totalUnexcusedMisses: 5, consecutiveUnexcusedMisses: 4 }),
    }))
  })

  it('leaves members active when either required threshold is not met', async () => {
    mocks.latestClosedAttendance.mockResolvedValue([
      { status: 'ABSENT', reviewStatus: 'UNEXCUSED' },
      { status: 'PRESENT', reviewStatus: 'NONE' },
      { status: 'ABSENT', reviewStatus: 'UNEXCUSED' },
      { status: 'ABSENT', reviewStatus: 'UNEXCUSED' },
    ])

    await expect(suspendForAttendanceIfEligible(transaction, 'member-id', 'committee-id')).resolves.toBe(false)
    expect(mocks.suspendMember).not.toHaveBeenCalled()
    expect(mocks.writeAuditLog).not.toHaveBeenCalled()
  })

  it('does not automatically suspend inactive members or super administrators', async () => {
    mocks.memberAttendancePolicyContext.mockResolvedValue({ status: 'INACTIVE', user: { role: 'MEMBER' } })
    await expect(suspendForAttendanceIfEligible(transaction, 'member-id', 'committee-id')).resolves.toBe(false)
    mocks.memberAttendancePolicyContext.mockResolvedValue({ status: 'ACTIVE', user: { role: 'SUPER_ADMIN' } })
    await expect(suspendForAttendanceIfEligible(transaction, 'member-id', 'committee-id')).resolves.toBe(false)
    expect(mocks.suspendMember).not.toHaveBeenCalled()
  })
})
