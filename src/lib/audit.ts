import type { Prisma } from '@prisma/client'

type AuditTransaction = Pick<Prisma.TransactionClient, 'auditLog'>
type AuditEvent = Omit<Prisma.AuditLogUncheckedCreateInput, 'id' | 'createdAt'>

export async function writeAuditLog(tx: AuditTransaction, event: AuditEvent) {
  await tx.auditLog.create({ data: event })
}
