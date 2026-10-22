import 'server-only'
import type { PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const financeOperationsRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
  currentSeason: (tx: Transaction) => tx.season.findFirst({ where: { isCurrent: true }, select: { id: true } }),
  productionExists: (tx: Transaction, productionId: string) =>
    tx.production.findUnique({ where: { id: productionId }, select: { id: true, seasonId: true } }),
  showDateExists: (tx: Transaction, showDateId: string) =>
    tx.showDate.findUnique({ where: { id: showDateId }, select: { id: true } }),
  seasonExists: (tx: Transaction, seasonId: string) =>
    tx.season.findUnique({ where: { id: seasonId }, select: { id: true } }),
  createBudget: (tx: Transaction, data: Prisma.BudgetUncheckedCreateInput) => tx.budget.create({ data }),
  createEntry: (tx: Transaction, data: Prisma.FinanceEntryUncheckedCreateInput) => tx.financeEntry.create({ data }),
  createReimbursement: (tx: Transaction, data: Prisma.ReimbursementUncheckedCreateInput) => tx.reimbursement.create({ data }),
  findReimbursement: (tx: Transaction, id: string) => tx.reimbursement.findUnique({ where: { id } }),
  updateReimbursement: (tx: Transaction, id: string, data: Prisma.ReimbursementUncheckedUpdateInput) =>
    tx.reimbursement.update({ where: { id }, data }),
  transitionReimbursement: (tx: Transaction, id: string, from: 'REQUESTED' | 'APPROVED', data: Prisma.ReimbursementUncheckedUpdateInput) =>
    tx.reimbursement.updateMany({ where: { id, status: from }, data }),
  isCurrentActiveMember: (tx: Transaction, memberId: string) => tx.seasonMembership.findFirst({
    where: { memberId, status: 'ACTIVE', season: { isCurrent: true } }, select: { memberId: true },
  }),
  createCampaign: (tx: Transaction, data: Prisma.FundraisingCampaignUncheckedCreateInput) =>
    tx.fundraisingCampaign.create({ data }),
  findCampaign: (tx: Transaction, id: string) => tx.fundraisingCampaign.findUnique({ where: { id }, select: { id: true, status: true } }),
  createContribution: (tx: Transaction, data: Prisma.ContributionUncheckedCreateInput) =>
    tx.contribution.create({ data }),
  createTicketType: (tx: Transaction, data: Prisma.TicketTypeUncheckedCreateInput) => tx.ticketType.create({ data }),
  findTicketType: (tx: Transaction, id: string) => tx.ticketType.findUnique({
    where: { id },
    include: { showDate: { select: { id: true, startsAt: true, productionId: true } } },
  }),
  findShowDate: (tx: Transaction, id: string) => tx.showDate.findUnique({ where: { id }, select: { id: true } }),
  countTicketSales: (tx: Transaction, ticketTypeId: string) => tx.ticketSale.aggregate({
    where: { ticketTypeId }, _sum: { quantity: true },
  }),
  createTicketSale: (tx: Transaction, data: Prisma.TicketSaleUncheckedCreateInput) => tx.ticketSale.create({ data }),
  findTicketSale: (tx: Transaction, id: string) => tx.ticketSale.findUnique({
    where: { id }, include: { refunds: { select: { amount: true } }, ticketType: { select: { showDateId: true } } },
  }),
  findTicketSaleForShow: (tx: Transaction, id: string, showDateId: string) => tx.ticketSale.findFirst({
    where: { id, ticketType: { showDateId } }, select: { id: true },
  }),
  createTicketRefund: (tx: Transaction, data: Prisma.TicketRefundUncheckedCreateInput) => tx.ticketRefund.create({ data }),
  createGuestEntry: (tx: Transaction, data: Prisma.GuestListEntryUncheckedCreateInput) => tx.guestListEntry.create({ data }),
  createReconciliationBatch: (tx: Transaction, data: Prisma.ReconciliationBatchUncheckedCreateInput) =>
    tx.reconciliationBatch.create({ data }),
  findReconciliationBatch: (tx: Transaction, id: string) => tx.reconciliationBatch.findUnique({
    where: { id }, include: { entries: true },
  }),
  updateReconciliationEntry: (tx: Transaction, id: string, data: Prisma.ReconciliationEntryUncheckedUpdateInput) =>
    tx.reconciliationEntry.update({ where: { id }, data }),
  createReconciliationEntry: (tx: Transaction, data: Prisma.ReconciliationEntryUncheckedCreateInput) =>
    tx.reconciliationEntry.create({ data }),
  findPotentialMatches: async (tx: Transaction, method: PaymentMethod, reference: string, amount: number) => {
    const [payments, ticketSales] = await Promise.all([
      tx.payment.findMany({
        where: { method, status: 'SUCCESS', reference, amount, reconciliationEntry: null },
        select: { id: true, amount: true, reference: true },
        take: 2,
      }),
      tx.ticketSale.findMany({
        where: { method, reference, totalAmount: amount, reconciliationEntry: null },
        select: { id: true, totalAmount: true, reference: true },
        take: 2,
      }),
    ])
    return [
      ...payments.map((payment) => ({ id: payment.id, amount: payment.amount, reference: payment.reference, paymentId: payment.id, ticketSaleId: null })),
      ...ticketSales.map((sale) => ({ id: sale.id, amount: sale.totalAmount, reference: sale.reference, paymentId: null, ticketSaleId: sale.id })),
    ]
  },
  closeReconciliationBatch: (tx: Transaction, id: string) =>
    tx.reconciliationBatch.update({ where: { id }, data: { status: 'RECONCILED' } }),

  listFinanceDashboard: async () => {
    const [budgets, entries, reimbursements, campaigns, contributions, ticketTypes, batches, guestEntries, seasons, productions] = await Promise.all([
      prisma.budget.findMany({ orderBy: [{ createdAt: 'desc' }], take: 100, include: { season: { select: { name: true } }, production: { select: { title: true } } } }),
      prisma.financeEntry.findMany({ orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 100 }),
      prisma.reimbursement.findMany({ where: { status: { in: ['REQUESTED', 'APPROVED'] } }, orderBy: [{ createdAt: 'asc' }], take: 100, include: { requestedBy: { select: { fullName: true } }, production: { select: { title: true } } } }),
      prisma.fundraisingCampaign.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }], take: 50, include: { _count: { select: { contributions: true } }, contributions: { select: { amount: true } } } }),
      prisma.contribution.findMany({ orderBy: [{ receivedAt: 'desc' }], take: 100, include: { campaign: { select: { title: true } } } }),
      prisma.ticketType.findMany({ orderBy: [{ showDate: { startsAt: 'asc' } }, { name: 'asc' }], take: 100, include: { showDate: { select: { id: true, startsAt: true, venue: true, production: { select: { title: true } } } }, sales: { select: { id: true, quantity: true, totalAmount: true, buyerName: true, reference: true, refunds: { select: { amount: true } } } } } }),
      prisma.reconciliationBatch.findMany({ orderBy: [{ statementDate: 'desc' }], take: 50, include: { entries: true } }),
      prisma.guestListEntry.findMany({ orderBy: [{ createdAt: 'desc' }], take: 100, include: { showDate: { select: { startsAt: true, venue: true, production: { select: { title: true } } } }, ticketSale: { select: { reference: true } } } }),
      prisma.season.findMany({ orderBy: [{ startDate: 'desc' }], take: 100, select: { id: true, name: true, isCurrent: true } }),
      prisma.production.findMany({ orderBy: [{ title: 'asc' }], take: 100, select: { id: true, title: true } }),
    ])
    return { budgets, entries, reimbursements, campaigns, contributions, ticketTypes, batches, guestEntries, seasons, productions }
  },

  listMemberReimbursements: (memberId: string) => prisma.reimbursement.findMany({
    where: { requestedByMemberId: memberId },
    orderBy: [{ createdAt: 'desc' }],
    take: 50,
    select: { id: true, amount: true, reason: true, receiptReference: true, status: true, paymentReference: true, createdAt: true },
  }),

  memberIdForUser: (userId: string) => prisma.member.findUnique({ where: { userId }, select: { id: true } }),
  reportRows: (seasonId: string, productionId: string) => {
    const scope = {
      ...(seasonId ? { seasonId } : {}),
      ...(productionId ? { productionId } : {}),
    }
    return Promise.all([
      prisma.financeEntry.findMany({ where: scope, select: { type: true, category: true, amount: true, description: true, occurredAt: true, receiptReference: true } }),
      prisma.contribution.findMany({ where: scope, select: { type: true, amount: true, contributor: true, receivedAt: true, reference: true } }),
      prisma.ticketSale.findMany({ where: { ticketType: { showDate: { productionId: productionId || undefined, production: { seasonId: seasonId || undefined } } } }, select: { totalAmount: true, soldAt: true, reference: true, ticketType: { select: { name: true } }, refunds: { select: { amount: true, refundedAt: true } } } }),
      productionId ? Promise.resolve([]) : prisma.payment.findMany({ where: { status: 'SUCCESS', ...(seasonId ? { seasonId } : {}) }, select: { type: true, amount: true, paidAt: true, reference: true } }),
    ])
  },

  listAvailableShows: () => prisma.showDate.findMany({
    where: { startsAt: { gte: new Date() } }, orderBy: [{ startsAt: 'asc' }], take: 100,
    select: { id: true, startsAt: true, venue: true, production: { select: { title: true, seasonId: true } } },
  }),
  financeFormOptions: () => Promise.all([
    prisma.season.findMany({ orderBy: [{ startDate: 'desc' }], take: 100, select: { id: true, name: true, isCurrent: true } }),
    prisma.production.findMany({ orderBy: [{ title: 'asc' }], take: 100, select: { id: true, title: true } }),
  ]),
}
