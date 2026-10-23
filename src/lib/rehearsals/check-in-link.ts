export function createCheckInLink(origin: string, rehearsalId: string, code: string) {
  const url = new URL('/member/attendance', origin)
  url.searchParams.set('rehearsalId', rehearsalId)
  url.hash = new URLSearchParams({ code }).toString()
  return url.toString()
}
