import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const memberImportRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work, { timeout: 30000 }),
  findExistingContacts: (tx: Transaction, phones: string[], emails: string[]) => Promise.all([
    tx.member.findMany({
      where: { OR: [{ phone: { in: phones } }, { email: { in: emails } }] },
      select: { phone: true, email: true },
    }),
    tx.user.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]),
  createUsers: (tx: Transaction, rows: Array<{ email: string; fullName: string }>) =>
    tx.user.createManyAndReturn({
      data: rows.map(({ email, fullName }) => ({ email, name: fullName, role: 'MEMBER' as const })),
      select: { id: true, email: true },
    }),
  createMembers: (tx: Transaction, rows: Array<{
    email: string
    fullName: string
    phone: string
    studentRegNo: string
  }>, userIds: Map<string, string>, importedAt: Date) =>
    tx.member.createManyAndReturn({
      data: rows.map((values) => {
        const userId = userIds.get(values.email)
        if (!userId) throw new Error('An imported member account was not created.')
        return {
          ...values,
          userId,
        status: 'PENDING_REGISTRATION' as const,
        emergencyContactName: '',
        emergencyContactPhone: '',
        joinedAt: importedAt,
        }
      }),
      select: { id: true },
    }),
  insertInitialStatusHistory: (tx: Transaction, memberIds: string[], effectiveAt: Date) => {
    if (!memberIds.length) return Promise.resolve(0)
    return tx.$executeRaw(Prisma.sql`
      INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
      VALUES ${Prisma.join(memberIds.map((memberId) => Prisma.sql`
        (${randomUUID()}, ${memberId}, 'PENDING_REGISTRATION'::"MemberStatus", ${effectiveAt})
      `))}
    `)
  },
  createImportAudit: (tx: Transaction, actorId: string, count: number) =>
    tx.auditLog.create({
      data: { actorId, action: 'MEMBERS_IMPORTED', entity: 'Member', entityId: 'batch', details: { count } },
    }),
  createMemberAudits: (tx: Transaction, actorId: string, memberIds: string[], importId: string) =>
    tx.auditLog.createMany({
      data: memberIds.map((memberId) => ({
        actorId, action: 'MEMBER_CREATED', entity: 'Member', entityId: memberId, details: { importId },
      })),
    }),
}
