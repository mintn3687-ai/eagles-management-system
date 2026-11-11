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
  attendanceCreateMany: vi.fn(),
  attendanceFindMany: vi.fn(),
  attendanceUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  auditCreateMany: vi.fn(),
  rehearsalUpdate: vi.fn(),
  rehearsalCreate: vi.fn(),
  rehearsalFindMany: vi.fn(),
  memberFindMany: vi.fn(),
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  lockRow: vi.fn(),
  consumeRateLimit: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction, rehearsal: { findMany: mocks.rehearsalFindMany } } }))
vi.mock('@/lib/permissions', () => ({
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
  isRestricted: () => false,
  AccessError: class AccessError extends Error {},
}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: mocks.consumeRateLimit }))

import { createRehearsal, finalizeDueRehearsals, markSelfAbsent, markSelfPresent, setManualAttendance } from '../src/lib/rehearsals/service'
import { formatNairobiTime } from '../src/lib/dates'
import { AttendanceSheet } from '../src/components/rehearsals/attendance-sheet'

const rehearsalId = 'c123456789012345678901234'
const memberId = 'c234567890123456789012345'
const existingCheckIn = new Date('2026-11-02T10:24:00.000Z')

describe('rehearsal attendance check-in time', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({
      rehearsal: { findUnique: mocks.rehearsalFindUnique, update: mocks.rehearsalUpdate, create: mocks.rehearsalCreate },
      member: { findUnique: mocks.memberFindUnique, findMany: mocks.memberFindMany },
      attendance: {
        findUnique: mocks.attendanceFindUnique,
        findMany: mocks.attendanceFindMany,
        update: mocks.attendanceUpdate,
        create: mocks.attendanceCreate,
        createMany: mocks.attendanceCreateMany,
        updateMany: mocks.attendanceUpdateMany,
        upsert: mocks.attendanceUpsert,
      },
      auditLog: { create: mocks.auditCreate, createMany: mocks.auditCreateMany },
    }))
    mocks.rehearsalFindUnique.mockResolvedValue({ id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), startTime: '17:00', endTime: '19:00', createdById: 'committee-id', status: 'OPEN', checkInCode: '1234' })
    mocks.memberFindUnique.mockResolvedValue({ id: memberId, status: 'ACTIVE' })
    mocks.attendanceFindUnique.mockResolvedValue(null)
    mocks.attendanceUpdate.mockResolvedValue(undefined)
    mocks.attendanceCreate.mockResolvedValue({ id: 'attendance-id' })
    mocks.attendanceUpsert.mockResolvedValue({ id: 'attendance-id' })
    mocks.attendanceCreateMany.mockResolvedValue({ count: 0 })
    mocks.attendanceFindMany.mockResolvedValue([])
    mocks.attendanceUpdateMany.mockResolvedValue({ count: 0 })
    mocks.auditCreate.mockResolvedValue(undefined)
    mocks.auditCreateMany.mockResolvedValue({ count: 0 })
    mocks.rehearsalUpdate.mockResolvedValue(undefined)
    mocks.rehearsalCreate.mockResolvedValue({
      id: rehearsalId,
      date: new Date('2030-01-01T00:00:00.000Z'),
      startTime: '17:00',
    })
    mocks.rehearsalFindMany.mockResolvedValue([])
    mocks.memberFindMany.mockResolvedValue([])
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
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'OPEN', checkInCode: '1234',
    })

    await markSelfPresent(rehearsalId, '1234')

    const [data] = mocks.attendanceUpsert.mock.calls[0]
    expect(data.where).toEqual({ rehearsalId_memberId: { rehearsalId, memberId } })
    expect(data.create.checkedInAt).toBeInstanceOf(Date)
    expect(data.create.checkedInAt).toEqual(data.create.markedAt)
    expect(formatNairobiTime(existingCheckIn)).toBe('13:24')
  })

  it('creates pending attendance for eligible active members when scheduling', async () => {
    mocks.memberFindMany.mockResolvedValue([{ id: memberId }])
    mocks.attendanceCreateMany.mockResolvedValue({ count: 1 })

    await createRehearsal({
      title: 'Weekly practice',
      date: '2030-01-01',
      startTime: '17:00',
      endTime: '19:00',
      venue: 'Main hall',
    })

    expect(mocks.attendanceCreateMany).toHaveBeenCalledWith({
      data: [{
        rehearsalId,
        memberId,
        status: 'NO_RESPONSE',
        markedBy: 'SYSTEM',
        reviewStatus: 'NONE',
      }],
      skipDuplicates: true,
    })
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
      locked: true,
    }))

    expect(markup).toContain('Checked in')
    expect(markup).toContain('13:24')
    expect(markup).not.toContain('Save')
  })

  it('preserves the original check-in when committee saves Present again', async () => {
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'OPEN',
    })
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
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'OPEN',
    })
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

  it('records a submitted absence reason and audit entry before the cutoff', async () => {
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'SCHEDULED',
    })

    await markSelfAbsent(rehearsalId, 'I have an unavoidable family commitment.')

    expect(mocks.attendanceUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'ABSENT', reason: 'I have an unavoidable family commitment.' }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'ABSENCE_REASON_SUBMITTED' }),
    }))
  })

  it('automatically closes due rehearsals and marks unanswered members absent', async () => {
    const now = new Date('2030-01-01T17:00:00.000Z')
    mocks.rehearsalFindMany.mockResolvedValue([{
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00',
    }])
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), startTime: '17:00', endTime: '19:00',
      createdById: 'committee-id', status: 'OPEN',
    })
    mocks.attendanceFindMany.mockResolvedValue([{ id: 'attendance-id', memberId }])

    await expect(finalizeDueRehearsals(now)).resolves.toEqual({ closedRehearsals: 1, markedAbsent: 1 })

    expect(mocks.rehearsalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'CLOSED', checkInCode: null },
    }))
    expect(mocks.attendanceUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ABSENT', markedBy: 'SYSTEM' }),
    }))
    expect(mocks.auditCreateMany).toHaveBeenCalled()
  })

  it('rejects committee attendance changes after the rehearsal is closed', async () => {
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'CLOSED',
    })

    await expect(setManualAttendance(rehearsalId, memberId, 'PRESENT', 'Verified by committee'))
      .rejects.toThrow('Attendance is closed.')
    expect(mocks.attendanceUpdate).not.toHaveBeenCalled()
  })

  it('rejects committee attendance changes at the exact scheduled end time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T16:00:00.000Z'))
    mocks.rehearsalFindUnique.mockResolvedValue({
      id: rehearsalId, date: new Date('2030-01-01T00:00:00.000Z'), endTime: '19:00', status: 'OPEN',
    })

    await expect(setManualAttendance(rehearsalId, memberId, 'PRESENT', 'Verified by committee'))
      .rejects.toThrow('Attendance is closed.')
    expect(mocks.attendanceUpdate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
