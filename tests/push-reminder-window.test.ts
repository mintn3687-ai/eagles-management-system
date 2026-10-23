import { describe, expect, it } from 'vitest'
import { getReminderDateRange, getRehearsalStart, REHEARSAL_REMINDER_WINDOW_MS } from '../src/modules/push/reminder-window'

describe('push reminder window', () => {
  it('covers the full 24 hours from now, including Nairobi date boundaries', () => {
    const now = new Date('2026-10-23T20:30:00.000Z')
    const range = getReminderDateRange(now)

    expect(range.from.toISOString()).toBe('2026-10-22T21:00:00.000Z')
    expect(range.through.toISOString()).toBe('2026-10-23T21:00:00.000Z')
    expect(range.endsAt.getTime() - now.getTime()).toBe(REHEARSAL_REMINDER_WINDOW_MS)
  })

  it('uses the rehearsal start time in Africa/Nairobi', () => {
    const rehearsalDate = new Date('2026-10-23T21:00:00.000Z')
    expect(getRehearsalStart(rehearsalDate, '09:30').toISOString()).toBe('2026-10-24T06:30:00.000Z')
  })
})
