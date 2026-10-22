export function normalizeKenyanPhone(phone: string): string | null {
  const compact = phone.trim().replace(/[\s()-]/g, '')
  if (!/^(?:07\d{8}|\+?2547\d{8})$/.test(compact)) return null
  return compact.startsWith('0') ? `254${compact.slice(1)}` : compact.replace(/^\+/, '')
}
