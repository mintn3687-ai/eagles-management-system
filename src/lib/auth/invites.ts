import { lockRow } from '../row-lock'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../db'
import { acceptInviteSchema, inviteTokenSchema } from '../validation/auth'
import { hashPassword } from './password'

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newInviteToken = () => randomBytes(32).toString('hex')

export async function findUsableInvite(token: unknown) {
  const parsed = inviteTokenSchema.safeParse(token)
  if (!parsed.success) return null
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(parsed.data) },
    select: { id: true, expiresAt: true, usedAt: true, user: { select: { isActive: true, passwordHash: true } } },
  })
  return invite && !invite.usedAt && invite.expiresAt > new Date() &&
    invite.user.isActive ? invite : null
}

export async function acceptInvite(input: unknown): Promise<boolean> {
  const parsed = acceptInviteSchema.safeParse(input)
  if (!parsed.success) return false
  const { token, password } = parsed.data
  if (!await findUsableInvite(token)) return false
  const passwordHash = await hashPassword(password)
  return prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { tokenHash: hashInviteToken(token) } })
    if (!invite) return false
    // Both acceptance and reissue take this lock before consuming invites.
    await lockRow(tx, 'User', invite.userId)
    const user = await tx.user.findUnique({ where: { id: invite.userId } })
    if (!user?.isActive) return false
    const now = new Date()
    const claimed = await tx.invite.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } })
    await tx.invite.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } })
    await tx.auditLog.create({ data: {
      actorId: user.id, action: user.passwordHash ? 'PASSWORD_RESET' : 'INVITE_ACCEPTED', entity: 'User', entityId: user.id, details: {},
    } })
    return true
  })
}
