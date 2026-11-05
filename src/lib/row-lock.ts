import { Prisma } from '@prisma/client'

/** Prisma qualifies ORM queries with the configured schema, but pooled connections
 * can execute unqualified raw SQL in public. Qualify locks too, so isolated tests
 * and deployments lock exactly the same rows that the ORM reads and writes. */
export async function lockRow(tx: Prisma.TransactionClient, table: 'User' | 'Member' | 'Payment' | 'PaymentEvent' | 'Rehearsal' | 'Meeting' | 'Motion' | 'Election' | 'Production' | 'ProductionTask' | 'Asset' | 'Reimbursement' | 'TicketType' | 'TicketSale' | 'ReconciliationBatch', id: string) {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'public'
  const identifier = Prisma.raw('"' + schema.replaceAll('"', '""') + '"."' + table + '"')
  await tx.$queryRaw`SELECT id FROM ${identifier} WHERE id = ${id} FOR UPDATE`
}
