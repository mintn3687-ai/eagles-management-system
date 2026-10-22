export const NAIROBI_TIMEZONE = 'Africa/Nairobi'
export function nairobiDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function parseNairobiDate(day: string, time = '00:00'): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Enter a valid date and time.')
  }
  const date = new Date(`${day}T${time}:00+03:00`)
  if (Number.isNaN(date.getTime()) || nairobiDateKey(date) !== day) throw new Error('Enter a valid date.')
  return date
}
export function formatNairobiDate(date: Date, includeTime = false): string {
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: NAIROBI_TIMEZONE, year: 'numeric', month: 'long', day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  }).format(date)
}
export function nairobiMonthBounds(date: Date = new Date()): { start: Date; end: Date } {
  const [year, month] = nairobiDateKey(date).split('-').map(Number)
  return {
    start: parseNairobiDate(`${year}-${String(month).padStart(2, '0')}-01`),
    end: parseNairobiDate(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`),
  }
}
