import { describe, expect, it } from 'vitest'
import { createCheckInLink } from '../src/lib/rehearsals/check-in-link'

describe('rehearsal check-in QR links', () => {
  it('puts the rehearsal id in the route and the check-in code in the URL fragment', () => {
    const link = new URL(createCheckInLink('https://club.example', 'rehearsal-123', '0427'))

    expect(link.pathname).toBe('/member/attendance')
    expect(link.searchParams.get('rehearsalId')).toBe('rehearsal-123')
    expect(link.search).not.toContain('0427')
    expect(new URLSearchParams(link.hash.slice(1)).get('code')).toBe('0427')
  })
})
