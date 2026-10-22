import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { requireRole } from '../permissions'
import { previewCsv } from './csv'
import { MemberError } from './errors'
import { z } from 'zod'
import { addMembersToCurrentSeason } from '@/modules/seasons/service'

const sourceSchema = z.string().min(1).max(512000)
export async function previewMemberImport(source: unknown, tx: Prisma.TransactionClient = prisma) {
  await requireRole('COMMITTEE')
  const rows = previewCsv(sourceSchema.parse(source))
  const phones = rows.filter((row) => !row.errors.length).map((row) => row.values.phone)
  const emails = rows.filter((row) => !row.errors.length).map((row) => row.values.email)
  const [members, users] = await Promise.all([
    tx.member.findMany({ where: { OR: [{ phone: { in: phones } }, { email: { in: emails } }] }, select: { phone: true, email: true } }),
    tx.user.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ])
  const usedPhones = new Set(members.map((m) => m.phone))
  const usedEmails = new Set([...members, ...users].map((m) => m.email))
  for (const row of rows) {
    if (usedPhones.has(row.values.phone)) row.errors.push('Phone already belongs to a member.')
    if (usedEmails.has(row.values.email)) row.errors.push('Email already belongs to a member or login account.')
  }
  return rows
}

export async function importMembers(source: unknown) {
  const actor = await requireRole('COMMITTEE')
  const parsed = sourceSchema.parse(source)
  return prisma.$transaction(async (tx) => {
    const rows = await previewMemberImport(parsed, tx)
    if (rows.some((row) => row.errors.length)) throw new MemberError('Nothing was imported. Fix the errors and duplicates, then preview again.')
    const users = await tx.user.createManyAndReturn({ data: rows.map(({ values }) => ({
      email: values.email, name: values.fullName, role: 'MEMBER' as const,
    })), select: { id: true, email: true } })
    const userIds = new Map(users.map((user) => [user.email, user.id]))
    const importedAt = new Date()
    const members = await tx.member.createManyAndReturn({ data: rows.map(({ values }) => ({
      ...values, userId: userIds.get(values.email)!, status: 'PENDING_REGISTRATION' as const,
      emergencyContactName: '', emergencyContactPhone: '', joinedAt: importedAt,
    })), select: { id: true } })
    await addMembersToCurrentSeason(tx, members.map((member) => ({
      memberId: member.id,
      status: 'PENDING_REGISTRATION',
    })))
    if (members.length) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
        VALUES ${Prisma.join(members.map((member) => Prisma.sql`(${randomUUID()}, ${member.id}, 'PENDING_REGISTRATION'::"MemberStatus", ${importedAt})`))}
      `)
    }
    const audit = await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'MEMBERS_IMPORTED', entity: 'Member', entityId: 'batch', details: { count: members.length },
    } })
    await tx.auditLog.createMany({ data: members.map((member) => ({
      actorId: actor.id, action: 'MEMBER_CREATED', entity: 'Member', entityId: member.id, details: { importId: audit.id },
    })) })
    return members.length
  }, { timeout: 30000 })
}
