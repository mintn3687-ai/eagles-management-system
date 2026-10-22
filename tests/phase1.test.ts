import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import { createFrozenSnapshot } from '../src/lib/frozen-snapshot'
import { isPaymentWithinSeason } from '../src/modules/finance/rules'
import { summarizeMemberAttendance } from '../src/modules/members/rules'
import { seasonCreateSchema } from '../src/modules/seasons/schema'
import { buildMembershipCarryForward, SeasonRuleError, suggestedNextSeasonDates } from '../src/modules/seasons/rules'
import { parseNairobiDate } from '../src/lib/dates'

describe('season membership rollover rules', () => {
  const members = [
    { memberId: 'member-active', status: 'ACTIVE' as const, roleInSeason: 'CHAIR', userRole: 'COMMITTEE' as const },
    { memberId: 'member-alumni', status: 'ALUMNI' as const, roleInSeason: 'MEMBER', userRole: 'MEMBER' as const },
  ]

  it('carries every membership, resets season fee totals, and changes only selected statuses', () => {
    const result = buildMembershipCarryForward(members, ['member-active'], 'INACTIVE')
    expect(result.memberships).toEqual([
      { memberId: 'member-active', status: 'INACTIVE', roleInSeason: 'CHAIR', feesOwed: 0, feesPaid: 0 },
      { memberId: 'member-alumni', status: 'ALUMNI', roleInSeason: 'MEMBER', feesOwed: 0, feesPaid: 0 },
    ])
    expect(result.changedMembers).toEqual([members[0]])
    expect(members[0].status).toBe('ACTIVE')
  })

  it('rejects duplicate, stale, and Super Admin selections', () => {
    expect(() => buildMembershipCarryForward(members, ['member-active', 'member-active'], 'ALUMNI'))
      .toThrow(SeasonRuleError)
    expect(() => buildMembershipCarryForward(members, ['member-alumni'], 'INACTIVE'))
      .toThrow(/no longer active/)
    expect(() => buildMembershipCarryForward([
      { ...members[0], userRole: 'SUPER_ADMIN' as const },
    ], ['member-active'], 'INACTIVE')).toThrow(/Transfer Super Admin/)
  })

  it('suggests a consecutive one-year season after the current inclusive end date', () => {
    expect(suggestedNextSeasonDates(parseNairobiDate('2026-12-31'))).toEqual({
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    })
    expect(suggestedNextSeasonDates(parseNairobiDate('2027-06-30'))).toEqual({
      startDate: '2027-07-01',
      endDate: '2028-06-30',
    })
  })

  it('validates dates, duplicate ids, and allows a season with no status changes', () => {
    const memberId = 'c123456789012345678901234'
    const valid = {
      name: '2027 season',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      memberIds: [],
      status: 'INACTIVE',
      confirmation: 'ROLLOVER',
    }
    expect(seasonCreateSchema.safeParse(valid).success).toBe(true)
    expect(seasonCreateSchema.safeParse({ ...valid, endDate: '2026-12-31' }).success).toBe(false)
    expect(seasonCreateSchema.safeParse({ ...valid, startDate: '2027-02-30' }).success).toBe(false)
    expect(seasonCreateSchema.safeParse({ ...valid, memberIds: [memberId, memberId] }).success).toBe(false)
  })
})

describe('phase 1 snapshot, payment, and member summaries', () => {
  it('hashes membership snapshots deterministically and changes when data changes', () => {
    const rows = [
      { id: 'b', status: 'ACTIVE', roleInSeason: 'MEMBER' },
      { id: 'a', status: 'ACTIVE', roleInSeason: 'CHAIR' },
    ]
    expect(createFrozenSnapshot(rows)).toEqual(createFrozenSnapshot([...rows].reverse()))
    expect(createFrozenSnapshot(rows).hash).not.toBe(createFrozenSnapshot([
      ...rows,
      { id: 'c', status: 'ACTIVE', roleInSeason: 'MEMBER' },
    ]).hash)
    expect(createFrozenSnapshot(rows).count).toBe(2)
  })

  it('includes payments on both inclusive Nairobi season boundaries', () => {
    const start = parseNairobiDate('2026-01-01')
    const end = parseNairobiDate('2026-12-31')
    expect(isPaymentWithinSeason(parseNairobiDate('2026-01-01'), start, end)).toBe(true)
    expect(isPaymentWithinSeason(parseNairobiDate('2026-12-31', '23:59'), start, end)).toBe(true)
    expect(isPaymentWithinSeason(parseNairobiDate('2027-01-01'), start, end)).toBe(false)
  })

  it('calculates attendance rate excluding excused absences', () => {
    expect(summarizeMemberAttendance([
      { present: 6, excused: 2, missed: 2 },
      { present: 1, excused: 0, missed: 1 },
    ])).toEqual({ present: 7, excused: 2, missed: 3, total: 12, percent: 70 })
    expect(summarizeMemberAttendance([])).toEqual({
      present: 0, excused: 0, missed: 0, total: 0, percent: 0,
    })
  })

  it('centralizes role checks for season and finance permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'seasons:manage')).toBe(true)
    expect(hasPermission('COMMITTEE', 'seasons:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'payments:manage')).toBe(true)
    expect(hasPermission('MEMBER', 'members:read')).toBe(false)
  })
})
