import 'server-only'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { AccessError, requireRole } from '@/lib/permissions'
import { lockRow } from '@/lib/row-lock'
import { recordMemberStatusChange } from '@/lib/members/status-history'
import { clubSettingsSchema, seasonRolloverSchema, teamRoleChangeSchema, transferAdminSchema } from '@/lib/validation/admin'
import type { ClubSettings } from '@/lib/validation/admin'

export class AdminManagementError extends Error {}

export function adminManagementError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Check the information and try again.'
  if (error instanceof AdminManagementError || error instanceof AccessError) return error.message
  return 'Could not save this change. Please try again.'
}

export async function saveClubSettings(input: unknown) {
  const actor = await requireRole('SUPER_ADMIN')
  const settings = clubSettingsSchema.parse(input)
  const entries = Object.entries(settings) as [keyof ClubSettings, ClubSettings[keyof ClubSettings]][]
  await prisma.$transaction(async (tx) => {
    const current = await tx.setting.findMany({ where: { key: { in: entries.map(([key]) => key) } } })
    const before = Object.fromEntries(current.map((row) => [row.key, row.value]))
    for (const [key, value] of entries) {
      await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id, action: 'CLUB_SETTINGS_UPDATED', entity: 'Setting', entityId: 'club',
        details: { before, after: settings },
      },
    })
  })
}

export async function changeTeamRole(input: unknown) {
  const actor = await requireRole('SUPER_ADMIN')
  const data = teamRoleChangeSchema.parse(input)
  await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: data.memberId }, select: { userId: true, fullName: true } })
    if (!member?.userId) throw new AdminManagementError('This member has no linked login account.')
    if (member.userId === actor.id) throw new AdminManagementError('Ask another Super Admin to change your role.')
    await lockRow(tx, 'User', member.userId)
    const user = await tx.user.findUnique({ where: { id: member.userId }, select: { role: true } })
    if (!user || user.role === 'SUPER_ADMIN') throw new AdminManagementError('Transfer Super Admin access from the transfer section.')
    if (user.role === data.role) return
    await tx.user.update({ where: { id: member.userId }, data: { role: data.role } })
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'TEAM_ROLE_CHANGED', entity: 'User', entityId: member.userId, details: { memberId: data.memberId, name: member.fullName, from: user.role, to: data.role } },
    })
  })
}

export async function transferSuperAdmin(input: unknown) {
  const actor = await requireRole('SUPER_ADMIN')
  const data = transferAdminSchema.parse(input)
  await prisma.$transaction(async (tx) => {
    const target = await tx.member.findUnique({ where: { id: data.memberId }, select: { userId: true, fullName: true, status: true } })
    if (!target?.userId) throw new AdminManagementError('Choose a member with a login account.')
    if (target.status !== 'ACTIVE') throw new AdminManagementError('Choose an active member to receive Super Admin access.')
    if (target.userId === actor.id) throw new AdminManagementError('Choose another member to receive Super Admin access.')
    for (const id of [actor.id, target.userId].sort()) await lockRow(tx, 'User', id)
    const [currentAdmin, nextAdmin] = await Promise.all([
      tx.user.findUnique({ where: { id: actor.id }, select: { role: true } }),
      tx.user.findUnique({ where: { id: target.userId }, select: { role: true, isActive: true } }),
    ])
    if (currentAdmin?.role !== 'SUPER_ADMIN') throw new AdminManagementError('Your Super Admin access has changed. Sign in again.')
    if (!nextAdmin || !nextAdmin.isActive || nextAdmin.role === 'SUPER_ADMIN') throw new AdminManagementError('Choose an active login that is not already a Super Admin.')
    await tx.user.update({ where: { id: target.userId }, data: { role: 'SUPER_ADMIN' } })
    await tx.user.update({ where: { id: actor.id }, data: { role: 'COMMITTEE' } })
    await tx.auditLog.createMany({ data: [
      { actorId: actor.id, action: 'SUPER_ADMIN_TRANSFERRED_TO', entity: 'User', entityId: target.userId, details: { memberId: data.memberId, name: target.fullName } },
      { actorId: actor.id, action: 'SUPER_ADMIN_TRANSFERRED_FROM', entity: 'User', entityId: actor.id, details: { memberId: data.memberId, name: target.fullName } },
    ] })
  })
}

export async function rolloverMembers(input: unknown) {
  const actor = await requireRole('SUPER_ADMIN')
  const data = seasonRolloverSchema.parse(input)
  const ids = [...data.memberIds].sort()
  await prisma.$transaction(async (tx) => {
    for (const id of ids) await lockRow(tx, 'Member', id)
    const members = await tx.member.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true, fullName: true, status: true, user: { select: { role: true } } },
    })
    if (members.length !== ids.length) throw new AdminManagementError('One or more selected members are no longer active. Refresh the list and try again.')
    if (members.some((member) => member.user?.role === 'SUPER_ADMIN')) throw new AdminManagementError('Transfer Super Admin access before including that account in a season rollover.')
    const now = new Date()
    for (const member of members) {
      if (member.status === data.status) continue
      await tx.member.update({ where: { id: member.id }, data: { status: data.status } })
      await recordMemberStatusChange(tx, member.id, member.status, data.status, now)
      await tx.auditLog.create({
        data: {
          actorId: actor.id, action: 'SEASON_ROLLOVER_STATUS_CHANGED', entity: 'Member', entityId: member.id,
          details: { name: member.fullName, from: member.status, to: data.status },
        },
      })
    }
  })
  return ids.length
}
