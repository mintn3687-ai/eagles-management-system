import 'server-only'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'
import { passwordVersion } from './auth/password-version'

export class AccessError extends Error {
  constructor(public status: 401 | 403, public code: 'LOGIN' | 'ROLE' | 'CONSENT' | 'RESTRICTED') {
    super(status === 401 ? 'Please sign in.' : 'You do not have access to this action.')
  }
}
export const roleLevel: Record<UserRole, number> = { MEMBER: 1, COMMITTEE: 2, SUPER_ADMIN: 3 }

export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new AccessError(401, 'LOGIN')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: {
    id: true, name: true, email: true, role: true, isActive: true, consentAcceptedAt: true, passwordHash: true,
    member: { select: { id: true, fullName: true, status: true } },
  } })
  if (!user?.isActive) throw new AccessError(401, 'LOGIN')
  if (!user.passwordHash || passwordVersion(user.passwordHash) !== session.user.passwordVersion) throw new AccessError(401, 'LOGIN')
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

export function isRestricted(user: Awaited<ReturnType<typeof requireUser>>) {
  return user.member?.status === 'SUSPENDED' || user.member?.status === 'INACTIVE'
}

export async function requireRole(minRole: UserRole) {
  const user = await requireUser()
  if (isRestricted(user)) throw new AccessError(403, 'RESTRICTED')
  if (!user.consentAcceptedAt) throw new AccessError(403, 'CONSENT')
  if (roleLevel[user.role] < roleLevel[minRole]) throw new AccessError(403, 'ROLE')
  return user
}
