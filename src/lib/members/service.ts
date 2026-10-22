import { lockRow } from '../row-lock'
import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { requireRole } from '../permissions'
import { userIdSchema } from '../validation'
import { memberCreateSchema, memberDetailsSchema, statusChangeSchema, roleChangeSchema } from '../validation/members'
import { hashInviteToken, newInviteToken } from '../auth/invites'
import { recordInitialMemberStatus, recordMemberStatusChange } from './status-history'
import { MemberError } from './errors'

export async function assertEmailAvailable(tx: Prisma.TransactionClient, email: string, memberId?: string, userId?: string | null) {
  const [member, user] = await Promise.all([
    tx.member.findUnique({ where: { email }, select: { id: true } }),
    tx.user.findUnique({ where: { email }, select: { id: true } }),
  ])
  if ((member && member.id !== memberId) || (user && user.id !== userId)) throw new MemberError('That email address already belongs to a member or login account.')
}

export async function createMember(input: unknown) {
  const actor = await requireRole('COMMITTEE')
  const data = memberCreateSchema.parse(input)
  const token = newInviteToken()
  const member = await prisma.$transaction(async (tx) => {
    await assertEmailAvailable(tx, data.email)
    const user = await tx.user.create({ data: { email: data.email, name: data.fullName, role: 'MEMBER' } })
    const { existingMember, ...details } = data
    const status = existingMember ? 'ACTIVE' : 'PENDING_REGISTRATION'
    const joinedAt = new Date()
    const member = await tx.member.create({ data: {
      ...details, userId: user.id, status, joinedAt,
    } })
    await recordInitialMemberStatus(tx, member.id, status, joinedAt)
    await tx.invite.create({ data: { userId: user.id, tokenHash: hashInviteToken(token), expiresAt: new Date(Date.now() + 7 * 86400000) } })
    await tx.auditLog.createMany({ data: [
      { actorId: actor.id, action: 'MEMBER_CREATED', entity: 'Member', entityId: member.id, details: { existingMember } },
      { actorId: actor.id, action: 'INVITE_CREATED', entity: 'User', entityId: user.id, details: {} },
    ] })
    return member
  })
  return { memberId: member.id, name: member.fullName, phone: member.phone, invitePath: `/invite/${token}` }
}

export async function editMember(id: unknown, input: unknown) {
  const actor = await requireRole('COMMITTEE')
  const memberId = userIdSchema.parse(id)
  const data = memberDetailsSchema.parse(input)
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Member', memberId)
    const member = await tx.member.findUnique({ where: { id: memberId } })
    if (!member) throw new MemberError('Member not found.')
    await assertEmailAvailable(tx, data.email, memberId, member.userId)
    await tx.member.update({ where: { id: memberId }, data })
    if (member.userId) {
      await tx.user.update({ where: { id: member.userId }, data: { email: data.email, name: data.fullName } })
      if (member.email !== data.email) await tx.invite.updateMany({ where: { userId: member.userId, usedAt: null }, data: { usedAt: new Date() } })
    }
    const fields = (Object.keys(data) as (keyof typeof data)[]).filter((key) => data[key] !== member[key])
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'MEMBER_EDITED', entity: 'Member', entityId: memberId, details: { fields } } })
  })
}

export async function changeMemberStatus(id: unknown, input: unknown) {
  const actor = await requireRole('COMMITTEE')
  const memberId = userIdSchema.parse(id)
  const data = statusChangeSchema.parse(input)
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Member', memberId)
    const member = await tx.member.findUnique({ where: { id: memberId } })
    if (!member) throw new MemberError('Member not found.')
    // Prevent a committee account from disabling the last administrator through membership status.
    const user = member.userId ? await tx.user.findUnique({ where: { id: member.userId }, select: { role: true } }) : null
    if (user?.role === 'SUPER_ADMIN' && ['INACTIVE', 'SUSPENDED'].includes(data.status)) throw new MemberError('Change this user’s role before restricting their membership.')
    const effectiveAt = new Date()
    await tx.member.update({ where: { id: memberId }, data: { status: data.status } })
    await recordMemberStatusChange(tx, memberId, member.status, data.status, effectiveAt)
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'MEMBER_STATUS_CHANGED', entity: 'Member', entityId: memberId,
      details: { from: member.status, to: data.status, reason: data.reason },
    } })
  })
}

export async function changeUserRole(id: unknown, input: unknown) {
  const actor = await requireRole('SUPER_ADMIN')
  const memberId = userIdSchema.parse(id)
  const { role } = roleChangeSchema.parse(input)
  await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: memberId }, select: { userId: true } })
    if (!member?.userId) throw new MemberError('This member has no linked login account.')
    if (member.userId === actor.id) throw new MemberError('Ask another Super Admin to change your role.')
    await lockRow(tx, 'User', member.userId)
    const user = await tx.user.findUniqueOrThrow({ where: { id: member.userId } })
    if (user.role === 'SUPER_ADMIN') throw new MemberError('Transfer Super Admin access from the team page.')
    await tx.user.update({ where: { id: user.id }, data: { role } })
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'USER_ROLE_CHANGED', entity: 'User', entityId: user.id, details: { from: user.role, to: role },
    } })
  })
}
