import 'server-only'
import { prisma } from '@/lib/db'
import { lockRow } from '@/lib/row-lock'
import type { ClubSettings } from '@/lib/validation/admin'
import type { teamRoleChangeSchema, transferAdminSchema } from '@/lib/validation/admin'
import type { z } from 'zod'

type TeamRoleChange = z.infer<typeof teamRoleChangeSchema>
type AdminTransfer = z.infer<typeof transferAdminSchema>

export class AdminManagementError extends Error {}

export async function saveClubSettings(actorId: string, settings: ClubSettings) {
  const entries = Object.entries(settings) as [keyof ClubSettings, ClubSettings[keyof ClubSettings]][]
  await prisma.$transaction(async (tx) => {
    const current = await tx.setting.findMany({ where: { key: { in: entries.map(([key]) => key) } } })
    const before = Object.fromEntries(current.map((row) => [row.key, row.value]))
    for (const [key, value] of entries) {
      await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    await tx.auditLog.create({
      data: {
        actorId, action: 'CLUB_SETTINGS_UPDATED', entity: 'Setting', entityId: 'club',
        details: { before, after: settings },
      },
    })
  })
}

export async function changeTeamRole(actorId: string, data: TeamRoleChange) {
  await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: data.memberId }, select: { userId: true, fullName: true } })
    if (!member?.userId) throw new AdminManagementError('This member has no linked login account.')
    if (member.userId === actorId) throw new AdminManagementError('Ask another Super Admin to change your role.')
    await lockRow(tx, 'User', member.userId)
    const user = await tx.user.findUnique({ where: { id: member.userId }, select: { role: true } })
    if (!user || user.role === 'SUPER_ADMIN') throw new AdminManagementError('Transfer Super Admin access from the transfer section.')
    if (user.role === data.role) return
    await tx.user.update({ where: { id: member.userId }, data: { role: data.role } })
    await tx.auditLog.create({
      data: {
        actorId, action: 'TEAM_ROLE_CHANGED', entity: 'User', entityId: member.userId,
        details: { memberId: data.memberId, name: member.fullName, from: user.role, to: data.role },
      },
    })
  })
}

export async function transferSuperAdmin(actorId: string, data: AdminTransfer) {
  await prisma.$transaction(async (tx) => {
    const target = await tx.member.findUnique({ where: { id: data.memberId }, select: { userId: true, fullName: true, status: true } })
    if (!target?.userId) throw new AdminManagementError('Choose a member with a login account.')
    if (target.status !== 'ACTIVE') throw new AdminManagementError('Choose an active member to receive Super Admin access.')
    if (target.userId === actorId) throw new AdminManagementError('Choose another member to receive Super Admin access.')
    for (const id of [actorId, target.userId].sort()) await lockRow(tx, 'User', id)
    const [currentAdmin, nextAdmin] = await Promise.all([
      tx.user.findUnique({ where: { id: actorId }, select: { role: true } }),
      tx.user.findUnique({ where: { id: target.userId }, select: { role: true, isActive: true } }),
    ])
    if (currentAdmin?.role !== 'SUPER_ADMIN') throw new AdminManagementError('Your Super Admin access has changed. Sign in again.')
    if (!nextAdmin || !nextAdmin.isActive || nextAdmin.role === 'SUPER_ADMIN') throw new AdminManagementError('Choose an active login that is not already a Super Admin.')
    await tx.user.update({ where: { id: target.userId }, data: { role: 'SUPER_ADMIN' } })
    await tx.user.update({ where: { id: actorId }, data: { role: 'COMMITTEE' } })
    await tx.auditLog.createMany({ data: [
      { actorId, action: 'SUPER_ADMIN_TRANSFERRED_TO', entity: 'User', entityId: target.userId, details: { memberId: data.memberId, name: target.fullName } },
      { actorId, action: 'SUPER_ADMIN_TRANSFERRED_FROM', entity: 'User', entityId: actorId, details: { memberId: data.memberId, name: target.fullName } },
    ] })
  })
}
