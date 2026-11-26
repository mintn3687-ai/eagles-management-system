import { describe, expect, it } from 'vitest'
import { meetsAttendanceSuspensionThresholds } from '../src/modules/attendance/suspension-rules'

const unexcusedAbsence = { status: 'ABSENT', reviewStatus: 'UNEXCUSED' } as const
const pendingAbsence = { status: 'NO_RESPONSE', reviewStatus: 'PENDING' } as const
const excusedAbsence = { status: 'ABSENT', reviewStatus: 'EXCUSED' } as const
const present = { status: 'PRESENT', reviewStatus: 'NONE' } as const

describe('attendance suspension policy', () => {
  it('requires both five total and four consecutive confirmed unexcused misses', () => {
    expect(meetsAttendanceSuspensionThresholds(5, Array(4).fill(unexcusedAbsence))).toBe(true)
    expect(meetsAttendanceSuspensionThresholds(4, Array(4).fill(unexcusedAbsence))).toBe(false)
    expect(meetsAttendanceSuspensionThresholds(5, [unexcusedAbsence, present, unexcusedAbsence, unexcusedAbsence])).toBe(false)
  })

  it('does not count pending or excused records as unexcused consecutive misses', () => {
    expect(meetsAttendanceSuspensionThresholds(5, [unexcusedAbsence, pendingAbsence, unexcusedAbsence, unexcusedAbsence])).toBe(false)
    expect(meetsAttendanceSuspensionThresholds(5, [unexcusedAbsence, excusedAbsence, unexcusedAbsence, unexcusedAbsence])).toBe(false)
  })

  it('does not suspend until four closed rehearsal records are available', () => {
    expect(meetsAttendanceSuspensionThresholds(5, Array(3).fill(unexcusedAbsence))).toBe(false)
  })
})
