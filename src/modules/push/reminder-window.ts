import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'

export const REHEARSAL_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000

export function getReminderDateRange(now: Date) {
  const end = new Date(now.getTime() + REHEARSAL_REMINDER_WINDOW_MS)
  return {
    from: parseNairobiDate(nairobiDateKey(now)),
    through: parseNairobiDate(nairobiDateKey(end)),
    endsAt: end,
  }
}

export function getRehearsalStart(date: Date, startTime: string) {
  return parseNairobiDate(nairobiDateKey(date), startTime)
}
