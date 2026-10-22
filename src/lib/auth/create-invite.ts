import { lockRow } from '../row-lock'
import 'server-only'
import { prisma } from '../db'
import { requireRole, AccessError } from '../permissions'
import { userIdSchema } from '../validation'
import { hashInviteToken, newInviteToken } from './invites'
import { consumeRateLimit } from '../rate-limit'

export class InviteError extends Error {}

export async function createInvite(userId: unknown) {
  const actor = await requireRole('COMMITTEE')
  const rate = await consumeRateLimit('invite-create', actor.id, 10, 60 * 60_000)
  if (!rate.allowed) throw new InviteError('Too many invitations have been created. Please try again later.')
  const targetId = userIdSchema.parse(userId)
  const token = newInviteToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'User', targetId)
    const user = await tx.user.findUnique({ where: { id: targetId } })
    if (!user?.isActive) throw new InviteError('Choose an active login account.')
    if (actor.role !== 'SUPER_ADMIN' && user.role !== 'MEMBER') throw new AccessError(403, 'ROLE')
    await tx.invite.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } })
    await tx.invite.create({ data: { userId: user.id, tokenHash: hashInviteToken(token), expiresAt } })
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'INVITE_CREATED', entity: 'User', entityId: user.id,
      details: { expiresAt: expiresAt.toISOString() },
    } })
  })
  return { path: `/invite/${token}`, expiresAt }
}
