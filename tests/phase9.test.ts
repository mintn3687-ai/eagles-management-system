import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { AccessError, requireRole } from '../src/lib/permissions'
import { passwordVersion } from '../src/lib/auth/password-version'
import { absenceDeadlinePassed, evaluateCheckInAttempt } from '../src/lib/attendance-rules'
import { attendancePercent } from '../src/lib/attendance-analytics'
import { classifyAttendanceForAnalytics } from '../src/lib/absences/counting'
import { selectEffectiveFeeVersion } from '../src/lib/fees'
import { normalizeKenyanPhone } from '../src/lib/validation/phone'

const routes = [
  ['/admin', 'COMMITTEE', 'src/app/admin/page.tsx', 'pageUser'],
  ['/admin/absences', 'COMMITTEE', 'src/app/admin/absences/page.tsx', 'pageUser'],
  ['/admin/analytics', 'COMMITTEE', 'src/app/admin/analytics/page.tsx', 'pageUser'],
  ['/admin/analytics/[memberId]', 'COMMITTEE', 'src/app/admin/analytics/[memberId]/page.tsx', 'pageUser'],
  ['/admin/audit', 'COMMITTEE', 'src/app/admin/audit/page.tsx', 'requireRole'],
  ['/admin/fees', 'COMMITTEE', 'src/app/admin/fees/page.tsx', 'pageUser'],
  ['/admin/members', 'COMMITTEE', 'src/app/admin/members/page.tsx', 'pageUser'],
  ['/admin/members/[id]', 'COMMITTEE', 'src/app/admin/members/[id]/page.tsx', 'pagePermission'],
  ['/admin/members/import', 'COMMITTEE', 'src/app/admin/members/import/page.tsx', 'pageUser'],
  ['/admin/members/new', 'COMMITTEE', 'src/app/admin/members/new/page.tsx', 'pageUser'],
  ['/admin/payments', 'COMMITTEE', 'src/app/admin/payments/page.tsx', 'pageUser'],
  ['/admin/payments/[id]', 'COMMITTEE', 'src/app/admin/payments/[id]/page.tsx', 'pageUser'],
  ['/admin/rehearsals', 'COMMITTEE', 'src/app/admin/rehearsals/page.tsx', 'pageUser'],
  ['/admin/rehearsals/[id]', 'COMMITTEE', 'src/app/admin/rehearsals/[id]/page.tsx', 'pageUser'],
  ['/admin/rehearsals/generate', 'COMMITTEE', 'src/app/admin/rehearsals/generate/page.tsx', 'pageUser'],
  ['/admin/settings', 'SUPER_ADMIN', 'src/app/admin/settings/page.tsx', 'pageUser'],
  ['/admin/team', 'SUPER_ADMIN', 'src/app/admin/team/page.tsx', 'pageUser'],
  ['/admin/rollover', 'SUPER_ADMIN', 'src/app/admin/rollover/page.tsx', 'pagePermission'],
  ['/admin/meetings', 'COMMITTEE', 'src/app/admin/meetings/page.tsx', 'pagePermission'],
  ['/admin/meetings/[id]', 'COMMITTEE', 'src/app/admin/meetings/[id]/page.tsx', 'pagePermission'],
  ['/member/meetings', 'MEMBER', 'src/app/member/meetings/page.tsx', 'pagePermission'],
  ['GET /admin/export', 'SUPER_ADMIN', 'src/app/admin/export/route.ts', 'requireRole'],
  ['GET /admin/analytics/export', 'COMMITTEE', 'src/app/admin/analytics/export/route.ts', 'requireRole'],
  ['GET /admin/members/export', 'COMMITTEE', 'src/app/admin/members/export/route.ts', 'requireRole'],
  ['GET /admin/payments/export', 'COMMITTEE', 'src/app/admin/payments/export/route.ts', 'requireRole'],
] as const
const roles = ['MEMBER', 'COMMITTEE', 'SUPER_ADMIN'] as const
const pagePermissions: Record<string, string> = {
  '/admin/members/[id]': 'members:read',
  '/admin/rollover': 'seasons:manage',
  '/admin/meetings': 'meetings:manage',
  '/admin/meetings/[id]': 'meetings:manage',
  '/member/meetings': 'meetings:read',
}

describe('admin role access', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user1', passwordVersion: passwordVersion('hash') } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user1', name: 'Test User', email: 'test@example.com', role: 'MEMBER', isActive: true,
      consentAcceptedAt: new Date(), passwordHash: 'hash', member: { id: 'member1', fullName: 'Test User', status: 'ACTIVE' },
    } as never)
  })

  it.each(routes)('$0 declares its $1 guard', (route, required, source, guard) => {
    const sourceText = readFileSync(resolve(process.cwd(), source), 'utf8')
    const permission = pagePermissions[route] ?? null
    const declaration = permission
      ? `pagePermission('${permission}')`
      : `${guard}('${required}')`
    expect(sourceText).toContain(declaration)
  })

  it.each(routes.flatMap(([route, required]) => roles.map((role) => ({ route, required, role }))))(
    '$role access to $route requires $required', async ({ required, role }) => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user1', name: 'Test User', email: 'test@example.com', role, isActive: true,
        consentAcceptedAt: new Date(), passwordHash: 'hash', member: { id: 'member1', fullName: 'Test User', status: 'ACTIVE' },
      } as never)
      if (roles.indexOf(role) < roles.indexOf(required)) {
        await expect(requireRole(required)).rejects.toMatchObject<Partial<AccessError>>({ status: 403, code: 'ROLE' })
      } else {
        await expect(requireRole(required)).resolves.toMatchObject({ role })
      }
    },
  )
})

describe('attendance rules', () => {
  it('accepts only the active code and locks after five wrong attempts', () => {
    expect(evaluateCheckInAttempt({ submittedCode: '0000', correctCode: '1234', wrongCodeTries: 0, status: null })).toBe('WRONG_CODE')
    expect(evaluateCheckInAttempt({ submittedCode: '1234', correctCode: '1234', wrongCodeTries: 4, status: null })).toBe('PRESENT')
    expect(evaluateCheckInAttempt({ submittedCode: '1234', correctCode: '1234', wrongCodeTries: 5, status: null })).toBe('ATTEMPTS_EXHAUSTED')
  })
  it('rejects double marking and enforces the absence deadline boundary', () => {
    expect(evaluateCheckInAttempt({ submittedCode: '1234', correctCode: '1234', wrongCodeTries: 0, status: 'PRESENT' })).toBe('ALREADY_PRESENT')
    const end = new Date('2026-01-01T10:00:00Z')
    expect(absenceDeadlinePassed(end, 2, new Date('2026-01-01T11:59:59Z'))).toBe(false)
    expect(absenceDeadlinePassed(end, 2, new Date('2026-01-01T12:00:01Z'))).toBe(true)
  })
})

describe('analytics and fee versions', () => {
  it('counts present and excused attendance consistently', () => {
    expect(classifyAttendanceForAnalytics({ status: 'PRESENT', reviewStatus: 'NONE' })).toBe('PRESENT')
    expect(classifyAttendanceForAnalytics({ status: 'ABSENT', reviewStatus: 'EXCUSED' })).toBe('EXCUSED')
    expect(classifyAttendanceForAnalytics({ status: 'NO_RESPONSE', reviewStatus: 'PENDING' })).toBe('MISSED')
    expect(attendancePercent(7, 3)).toBe(70)
    expect(attendancePercent(0, 0)).toBe(0)
  })
  it('selects the latest fee version effective on the requested date', () => {
    const versions = [
      { id: 'v1', effectiveFrom: new Date('2026-01-01'), amount: 500 },
      { id: 'v2', effectiveFrom: new Date('2026-06-01'), amount: 700 },
    ]
    expect(selectEffectiveFeeVersion(versions, new Date('2026-05-31'))?.amount).toBe(500)
    expect(selectEffectiveFeeVersion(versions, new Date('2026-06-01'))?.amount).toBe(700)
  })
})

describe('phone normalization', () => {
  it.each([['0712 345 678', '254712345678'], ['+254 (712) 345-678', '254712345678'], ['254712345678', '254712345678']])(
    'normalizes %s', (source, expected) => expect(normalizeKenyanPhone(source)).toBe(expected),
  )
  it('rejects invalid and non-Kenyan numbers', () => expect(normalizeKenyanPhone('071234')).toBeNull())
})
