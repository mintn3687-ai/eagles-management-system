import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { lockRow } from '@/lib/row-lock'
import { financeOperationsRepository as repository } from './operations-repository'
import { FinanceRuleError, selectExactPaymentMatch } from './operations-rules'
import { FinanceOperationsError } from './operations-errors'
export { FinanceOperationsError } from './operations-errors'

function mapError(error: unknown): never {
  if (error instanceof FinanceRuleError) throw new FinanceOperationsError(error.message)
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new FinanceOperationsError('A record with this reference already exists.')
  }
  throw error
}

async function validateScope(tx: Prisma.TransactionClient, seasonId: string, productionId: string) {
  if (seasonId && !await repository.seasonExists(tx, seasonId)) throw new FinanceOperationsError('Choose a valid season.')
  if (productionId) {
    const production = await repository.productionExists(tx, productionId)
    if (!production) throw new FinanceOperationsError('Choose a valid production.')
    if (seasonId && production.seasonId && production.seasonId !== seasonId) {
      throw new FinanceOperationsError('Choose a season that matches the production.')
    }
  }
}

export async function createBudget(input: {
  seasonId: string; productionId: string; category: string; amount: number; notes: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await validateScope(tx, input.seasonId, input.productionId)
    const budget = await repository.createBudget(tx, {
      ...input, seasonId: input.seasonId || null, productionId: input.productionId || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'FINANCE_BUDGET_CREATED', entity: 'Budget', entityId: budget.id,
      details: { seasonId: input.seasonId || null, productionId: input.productionId || null, category: input.category, amount: input.amount },
    })
    return budget
  }).catch(mapError)
}

export async function recordFinanceEntry(input: {
  type: 'INCOME' | 'EXPENSE'; seasonId: string; productionId: string; category: string;
  amount: number; description: string; receiptReference: string; date: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await validateScope(tx, input.seasonId, input.productionId)
    const entry = await repository.createEntry(tx, {
      ...input, occurredAt: parseNairobiDate(input.date), seasonId: input.seasonId || null,
      productionId: input.productionId || null, receiptReference: input.receiptReference || null,
      recordedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'FINANCE_ENTRY_RECORDED', entity: 'FinanceEntry', entityId: entry.id,
      details: { type: input.type, category: input.category, amount: input.amount, seasonId: input.seasonId || null, productionId: input.productionId || null },
    })
    return entry
  }).catch(mapError)
}

export async function requestReimbursement(input: {
  amount: number; reason: string; receiptReference: string; seasonId: string; productionId: string
}, memberId: string, actorId: string) {
  return repository.transaction(async (tx) => {
    if (!await repository.isCurrentActiveMember(tx, memberId)) {
      throw new FinanceOperationsError('Only an active current-season member can request reimbursement.')
    }
    await validateScope(tx, input.seasonId, input.productionId)
    const request = await repository.createReimbursement(tx, {
      ...input, requestedByMemberId: memberId, receiptReference: input.receiptReference || null,
      seasonId: input.seasonId || null, productionId: input.productionId || null,
    })
    await writeAuditLog(tx, {
      actorId, action: 'REIMBURSEMENT_REQUESTED', entity: 'Reimbursement', entityId: request.id,
      details: { amount: input.amount, seasonId: input.seasonId || null, productionId: input.productionId || null },
    })
    return request
  }).catch(mapError)
}

export async function decideReimbursement(id: string, decision: 'APPROVED' | 'REJECTED', actorId: string) {
  return repository.transaction(async (tx) => {
    const reimbursement = await repository.findReimbursement(tx, id)
    if (!reimbursement) throw new FinanceOperationsError('Reimbursement request not found.')
    if (reimbursement.status !== 'REQUESTED') throw new FinanceOperationsError('This request has already been reviewed.')
    const updated = await repository.transitionReimbursement(tx, id, 'REQUESTED', {
      status: decision, approvedById: actorId, decidedAt: new Date(),
    })
    if (!updated.count) throw new FinanceOperationsError('This request has already been reviewed.')
    await writeAuditLog(tx, {
      actorId, action: `REIMBURSEMENT_${decision}`, entity: 'Reimbursement', entityId: id,
      details: { amount: reimbursement.amount },
    })
    return repository.findReimbursement(tx, id)
  }).catch(mapError)
}

export async function payReimbursement(id: string, paymentReference: string, actorId: string) {
  return repository.transaction(async (tx) => {
    await lockRow(tx, 'Reimbursement', id)
    const reimbursement = await repository.findReimbursement(tx, id)
    if (!reimbursement) throw new FinanceOperationsError('Reimbursement request not found.')
    if (reimbursement.status !== 'APPROVED') throw new FinanceOperationsError('Only an approved reimbursement can be paid.')
    const paidAt = new Date()
    const updated = await repository.transitionReimbursement(tx, id, 'APPROVED', {
      status: 'PAID', paidById: actorId, paidAt, paymentReference,
    })
    if (!updated.count) throw new FinanceOperationsError('This reimbursement has already been paid or changed.')
    await repository.createEntry(tx, {
      type: 'EXPENSE', category: 'Reimbursement', amount: reimbursement.amount,
      description: reimbursement.reason, receiptReference: paymentReference, occurredAt: paidAt,
      seasonId: reimbursement.seasonId, productionId: reimbursement.productionId, recordedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'REIMBURSEMENT_PAID', entity: 'Reimbursement', entityId: id,
      details: { amount: reimbursement.amount, paymentReference },
    })
    return { paid: true }
  }).catch(mapError)
}

export async function createCampaign(input: {
  title: string; description: string; goalAmount: number; seasonId: string; productionId: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await validateScope(tx, input.seasonId, input.productionId)
    const campaign = await repository.createCampaign(tx, {
      ...input, description: input.description || null, seasonId: input.seasonId || null,
      productionId: input.productionId || null, createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'FUNDRAISING_CAMPAIGN_CREATED', entity: 'FundraisingCampaign', entityId: campaign.id,
      details: { goalAmount: input.goalAmount },
    })
    return campaign
  }).catch(mapError)
}

export async function recordContribution(input: {
  campaignId: string; type: 'DONATION' | 'SPONSORSHIP'; contributor: string; amount: number;
  method: 'MPESA' | 'CASH' | 'OTHER'; reference: string; seasonId: string; productionId: string; date: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await validateScope(tx, input.seasonId, input.productionId)
    if (input.campaignId) {
      const campaign = await repository.findCampaign(tx, input.campaignId)
      if (!campaign || campaign.status !== 'ACTIVE') throw new FinanceOperationsError('Choose an active fundraising campaign.')
    }
    const contribution = await repository.createContribution(tx, {
      ...input, contributor: input.contributor || null, reference: input.reference || null,
      receivedAt: parseNairobiDate(input.date), campaignId: input.campaignId || null,
      seasonId: input.seasonId || null, productionId: input.productionId || null, recordedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'FINANCE_CONTRIBUTION_RECORDED', entity: 'Contribution', entityId: contribution.id,
      details: { type: input.type, amount: input.amount, campaignId: input.campaignId || null },
    })
    return contribution
  }).catch(mapError)
}

export async function openReconciliation(input: { method: 'MPESA' | 'CASH' | 'OTHER'; statementDate: string; reference: string }, actorId: string) {
  return repository.transaction(async (tx) => {
    const batch = await repository.createReconciliationBatch(tx, {
      ...input, statementDate: parseNairobiDate(input.statementDate), createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PAYMENT_RECONCILIATION_OPENED', entity: 'ReconciliationBatch', entityId: batch.id,
      details: { method: input.method, statementDate: input.statementDate },
    })
    return batch
  }).catch(mapError)
}

export async function addStatementEntry(input: {
  batchId: string; statementReference: string; amount: number; notes: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await lockRow(tx, 'ReconciliationBatch', input.batchId)
    const batch = await repository.findReconciliationBatch(tx, input.batchId)
    if (!batch || batch.status !== 'OPEN') throw new FinanceOperationsError('Choose an open reconciliation batch.')
    const candidates = await repository.findPotentialMatches(tx, batch.method, input.statementReference, input.amount)
    const match = selectExactPaymentMatch(candidates, input.statementReference, input.amount)
    const entry = await repository.createReconciliationEntry(tx, {
      ...input, paymentId: match?.paymentId ?? null, ticketSaleId: match?.ticketSaleId ?? null,
      matchedAt: match ? new Date() : null,
    })
    await writeAuditLog(tx, {
      actorId, action: match ? 'PAYMENT_RECONCILIATION_MATCHED' : 'PAYMENT_RECONCILIATION_UNMATCHED',
      entity: 'ReconciliationEntry', entityId: entry.id,
      details: { method: batch.method, amount: input.amount, matched: Boolean(match) },
    })
    return { entry, matched: Boolean(match) }
  }).catch(mapError)
}

export async function closeReconciliation(batchId: string, actorId: string) {
  return repository.transaction(async (tx) => {
    await lockRow(tx, 'ReconciliationBatch', batchId)
    const batch = await repository.findReconciliationBatch(tx, batchId)
    if (!batch || batch.status !== 'OPEN') throw new FinanceOperationsError('Reconciliation batch is not open.')
    if (!batch.entries.length || batch.entries.some((entry) => !entry.paymentId && !entry.ticketSaleId)) {
      throw new FinanceOperationsError('Match every statement entry before completing reconciliation.')
    }
    await repository.closeReconciliationBatch(tx, batchId)
    await writeAuditLog(tx, {
      actorId, action: 'PAYMENT_RECONCILIATION_COMPLETED', entity: 'ReconciliationBatch', entityId: batchId,
      details: { entryCount: batch.entries.length },
    })
    return { reconciled: true }
  }).catch(mapError)
}

export async function getFinanceDashboard() {
  return repository.listFinanceDashboard()
}

export async function getMemberReimbursements(memberId: string) {
  return repository.listMemberReimbursements(memberId)
}

export async function getFinancialReport(seasonId: string, productionId: string) {
  const [entries, contributions, ticketSales, payments] = await repository.reportRows(seasonId, productionId)
  const rows = [
    ...entries.map((entry) => ({ date: entry.occurredAt, direction: entry.type, category: entry.category, amount: entry.amount, description: entry.description, reference: entry.receiptReference ?? '' })),
    ...contributions.map((item) => ({ date: item.receivedAt, direction: 'INCOME' as const, category: item.type, amount: item.amount, description: item.contributor ?? item.type, reference: item.reference ?? '' })),
    ...ticketSales.flatMap((sale) => [
      { date: sale.soldAt, direction: 'INCOME' as const, category: 'TICKET_SALE', amount: sale.totalAmount, description: sale.ticketType.name, reference: sale.reference ?? '' },
      ...sale.refunds.map((refund) => ({ date: refund.refundedAt, direction: 'EXPENSE' as const, category: 'TICKET_REFUND', amount: refund.amount, description: sale.ticketType.name, reference: sale.reference ?? '' })),
    ]),
    ...payments.map((payment) => ({ date: payment.paidAt ?? new Date(0), direction: 'INCOME' as const, category: payment.type, amount: payment.amount, description: payment.type, reference: payment.reference ?? '' })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
  return rows
}

export async function listAvailableTicketShows() {
  return repository.listAvailableShows()
}

export async function listFinanceFormOptions() {
  const [seasons, productions] = await repository.financeFormOptions()
  return { seasons, productions }
}
