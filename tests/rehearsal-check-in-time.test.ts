import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  rehearsalFindUnique: vi.fn(),
  memberFindUnique: vi.fn(),
  attendanceFindUnique: vi.fn(),
  attendanceUpdate: vi.fn(),
  attendanceCreate: vi.fn(),
  attendanceUpsert: vi.fn(),
  auditCreate: vi.fn(),
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  lockRow: vi.fn(),
  consumeRateLimit: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock('@/lib/permissions', () => ({
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
  isRestricted: () => false,
  AccessError: class AccessError extends Error {},
}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: mocks.consumeRateLimit }))

import { markSelfPresent, setManualAttendance } from '../src/lib/rehearsals/service'
import { formatNairobiTime } from '../src/lib/dates'
import { AttendanceSheet } from '../src/components/rehearsals/attendance-sheet'

const rehearsalId = 'c123456789012345678901234'
const memberId = 'c234567890123456789012345'
const existingCheckIn = new Date('2026-11-02T10:24:00.000Z')

describe('rehearsal attendance check-in time', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({
      rehearsal: { findUnique: mocks.rehearsalFindUnique },
      member: { findUnique: mocks.memberFindUnique },
      attendance: {
        findUnique: mocks.attendanceFindUnique,
        update: mocks.attendanceUpdate,
        create: mocks.attendanceCreate,
        upsert: mocks.attendanceUpsert,
      },
      auditLog: { create: mocks.auditCreate },
    }))
    mocks.rehearsalFindUnique.mockResolvedValue({ id: rehearsalId, status: 'CLOSED', checkInCode: '1234' })
    mocks.memberFindUnique.mockResolvedValue({ id: memberId, status: 'ACTIVE' })
    mocks.attendanceFindUnique.mockResolvedValue(null)
    mocks.attendanceUpdate.mockResolvedValue(undefined)
    mocks.attendanceCreate.mockResolvedValue({ id: 'attendance-id' })
    mocks.attendanceUpsert.mockResolvedValue({})
    mocks.auditCreate.mockResolvedValue(undefined)
    mocks.requireRole.mockResolvedValue({ id: 'committee-id' })
    mocks.requireUser.mockResolvedValue({
      id: 'member-user-id',
      member: { id: memberId },
      consentAcceptedAt: new Date(),
    })
    mocks.lockRow.mockResolvedValue(undefined)
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true })
  })

  it('records and displays a self check-in time in Nairobi time', async () => {
    mocks.rehearsalFindUnique.mockResolvedValue({ id: rehearsalId, status: 'OPEN', checkInCode: '1234' })

    await markSelfPresent(rehearsalId, '1234')

    const [data] = mocks.attendanceUpsert.mock.calls[0]
    expect(data.where).toEqual({ rehearsalId_memberId: { rehearsalId, memberId } })
    expect(data.create.checkedInAt).toBeInstanceOf(Date)
    expect(data.create.checkedInAt).toEqual(data.create.markedAt)
    expect(formatNairobiTime(existingCheckIn)).toBe('13:24')
  })

  it('renders the check-in time on the attendance sheet', () => {
    const markup = renderToStaticMarkup(createElement(AttendanceSheet, {
      rehearsal: {
        id: rehearsalId, title: 'Rehearsal', date: new Date(), startTime: '17:00',
        endTime: '19:00', venue: 'Hall', status: 'CLOSED', checkInCode: null,
      },
      members: [{
        id: memberId, fullName: 'Drama Member', phone: '0700000000', joinedAt: new Date(),
        status: 'ACTIVE',
        rehearsals: [{
          id: 'attendance-id', status: 'PRESENT', markedBy: 'SELF', checkedInAt: existingCheckIn,
          reason: null, reviewStatus: 'NONE',
        }],
      }],
      totalMembers: 1,
      page: 1,
      pageCount: 1,
    }))

    expect(markup).toContain('Checked in')
    expect(markup).toContain('13:24')
  })

  it('preserves the original check-in when committee saves Present again', async () => {
    mocks.attendanceFindUnique.mockResolvedValue({
      id: 'attendance-id',
      status: 'PRESENT',
      checkedInAt: existingCheckIn,
    })

    await setManualAttendance(rehearsalId, memberId, 'PRESENT')

    expect(mocks.attendanceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PRESENT', checkedInAt: existingCheckIn }),
    }))
  })

  it('records a new time when attendance changes to Present and clears it when marked Absent', async () => {
    mocks.attendanceFindUnique.mockResolvedValue({
      id: 'attendance-id',
      status: 'NO_RESPONSE',
      checkedInAt: null,
    })

    await setManualAttendance(rehearsalId, memberId, 'PRESENT', 'Verified by committee')
    const presentData = mocks.attendanceUpdate.mock.calls[0][0].data
    expect(presentData.checkedInAt).toBeInstanceOf(Date)
    expect(presentData.checkedInAt).toEqual(presentData.markedAt)

    mocks.attendanceFindUnique.mockResolvedValue({
      id: 'attendance-id',
      status: 'PRESENT',
      checkedInAt: presentData.checkedInAt,
    })
    await setManualAttendance(rehearsalId, memberId, 'ABSENT')
    expect(mocks.attendanceUpdate.mock.calls[1][0].data.checkedInAt).toBeNull()
  })
})
