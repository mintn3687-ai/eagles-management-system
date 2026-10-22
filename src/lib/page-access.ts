import { redirect } from 'next/navigation'
import type { UserRole } from '@prisma/client'
import { AccessError, requireRole, requireUser } from './permissions'

export async function pageUser(minRole?: UserRole) {
  try {
    return minRole ? await requireRole(minRole) : await requireUser()
  } catch (error) {
    if (!(error instanceof AccessError)) throw error
    if (error.code === 'LOGIN') redirect('/login')
    if (error.code === 'CONSENT') redirect('/consent')
    if (error.code === 'RESTRICTED') redirect('/member')
    redirect('/forbidden')
  }
}

export async function pageMember() {
  const user = await pageUser('MEMBER')
  if (!user.member) redirect(user.role === 'MEMBER' ? '/forbidden' : '/admin')
  if (user.member.status === 'PENDING_REGISTRATION') redirect('/member/fees')
  if (user.member.status !== 'ACTIVE') redirect('/member')
  return user
}
