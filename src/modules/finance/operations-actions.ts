'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  budgetSchema, campaignSchema, contributionSchema, financeEntrySchema, guestEntrySchema,
  reconciliationBatchSchema, reimbursementDecisionSchema, reimbursementPaySchema,
  reimbursementRequestSchema, statementEntrySchema, ticketRefundSchema, ticketSaleSchema,
  ticketTypeSchema,
} from './operations-schema'
import {
  addStatementEntry, closeReconciliation, createBudget, createCampaign,
  decideReimbursement, FinanceOperationsError, openReconciliation,
  payReimbursement, recordContribution, recordFinanceEntry,
  requestReimbursement,
} from './operations-service'
import { addGuestEntry, createTicketType, recordTicketSale, refundTicket } from './ticketing-service'

export type FinanceActionState = { success?: boolean; message?: string; error?: string }

function value(form: FormData, key: string) {
  const item = form.get(key)
  return typeof item === 'string' ? item : ''
}

function number(form: FormData, key: string) {
  const raw = value(form, key)
  return raw.trim() ? Number(raw) : Number.NaN
}

function invalid(parsed: { success: false; error: { issues: Array<{ message: string }> } }): never {
  throw new FinanceOperationsError(parsed.error.issues[0]?.message ?? 'Check the finance details.')
}

async function execute<T>(
  permission: 'finance:manage' | 'reimbursements:request',
  form: FormData,
  parse: (form: FormData) => T,
  work: (input: T, actor: Awaited<ReturnType<typeof requirePermission>>) => Promise<unknown>,
  message: string,
): Promise<FinanceActionState> {
  try {
    const actor = await requirePermission(permission)
    const input = parse(form)
    if (permission === 'reimbursements:request' && !actor.member) return { error: 'A linked member account is required.' }
    const result = await work(input, actor)
    revalidatePath('/admin/finance')
    revalidatePath('/member/reimbursements')
    return { success: true, message: typeof result === 'string' ? result : message }
  } catch (error) {
    if (error instanceof AccessError || error instanceof FinanceOperationsError) return { error: error.message }
    return { error: 'Could not save this finance change. Please try again.' }
  }
}

export async function createBudgetAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = budgetSchema.safeParse({ seasonId: value(data, 'seasonId'), productionId: value(data, 'productionId'), category: value(data, 'category'), amount: number(data, 'amount'), notes: value(data, 'notes') })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => createBudget(input, actor.id), 'Budget saved.')
}

export async function recordFinanceEntryAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = financeEntrySchema.safeParse({
      type: value(data, 'type'), seasonId: value(data, 'seasonId'), productionId: value(data, 'productionId'),
      category: value(data, 'category'), amount: number(data, 'amount'), description: value(data, 'description'),
      receiptReference: value(data, 'receiptReference'), date: value(data, 'date'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => recordFinanceEntry(input, actor.id), 'Finance entry recorded.')
}

export async function requestReimbursementAction(_state: FinanceActionState, form: FormData) {
  return execute('reimbursements:request', form, (data) => {
    const parsed = reimbursementRequestSchema.safeParse({
      amount: number(data, 'amount'), reason: value(data, 'reason'), receiptReference: value(data, 'receiptReference'),
      seasonId: value(data, 'seasonId'), productionId: value(data, 'productionId'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, async (input, actor) => {
    if (!actor.member) throw new FinanceOperationsError('A linked member account is required.')
    await requestReimbursement(input, actor.member.id, actor.id)
  }, 'Reimbursement request submitted.')
}

export async function decideReimbursementAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = reimbursementDecisionSchema.safeParse({ reimbursementId: value(data, 'reimbursementId'), decision: value(data, 'decision') })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => decideReimbursement(input.reimbursementId, input.decision, actor.id), 'Reimbursement decision recorded.')
}

export async function payReimbursementAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = reimbursementPaySchema.safeParse({ reimbursementId: value(data, 'reimbursementId'), paymentReference: value(data, 'paymentReference') })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => payReimbursement(input.reimbursementId, input.paymentReference, actor.id), 'Reimbursement marked paid.')
}

export async function createCampaignAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = campaignSchema.safeParse({
      title: value(data, 'title'), description: value(data, 'description'), goalAmount: number(data, 'goalAmount'),
      seasonId: value(data, 'seasonId'), productionId: value(data, 'productionId'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => createCampaign(input, actor.id), 'Fundraising campaign created.')
}

export async function recordContributionAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = contributionSchema.safeParse({
      campaignId: value(data, 'campaignId'), type: value(data, 'type'), contributor: value(data, 'contributor'),
      amount: number(data, 'amount'), method: value(data, 'method'), reference: value(data, 'reference'),
      seasonId: value(data, 'seasonId'), productionId: value(data, 'productionId'), date: value(data, 'date'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => recordContribution(input, actor.id), 'Contribution recorded.')
}

export async function createTicketTypeAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const capacity = value(data, 'quantityAvailable')
    const parsed = ticketTypeSchema.safeParse({
      showDateId: value(data, 'showDateId'), name: value(data, 'name'), price: number(data, 'price'),
      quantityAvailable: capacity ? Number(capacity) : '',
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => createTicketType(input, actor.id), 'Ticket type created.')
}

export async function recordTicketSaleAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = ticketSaleSchema.safeParse({
      ticketTypeId: value(data, 'ticketTypeId'), quantity: number(data, 'quantity'), buyerName: value(data, 'buyerName'),
      method: value(data, 'method'), reference: value(data, 'reference'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => recordTicketSale(input, actor.id), 'Ticket sale recorded.')
}

export async function refundTicketAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = ticketRefundSchema.safeParse({ ticketSaleId: value(data, 'ticketSaleId'), amount: number(data, 'amount'), reason: value(data, 'reason') })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => refundTicket(input, actor.id), 'Ticket refund recorded.')
}

export async function addGuestEntryAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = guestEntrySchema.safeParse({
      showDateId: value(data, 'showDateId'), ticketSaleId: value(data, 'ticketSaleId'),
      name: value(data, 'name'), note: value(data, 'note'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => addGuestEntry(input, actor.id), 'Guest added to the list.')
}

export async function openReconciliationAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = reconciliationBatchSchema.safeParse({
      method: value(data, 'method'), statementDate: value(data, 'statementDate'), reference: value(data, 'reference'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, (input, actor) => openReconciliation(input, actor.id), 'Reconciliation batch opened.')
}

export async function addStatementEntryAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const parsed = statementEntrySchema.safeParse({
      batchId: value(data, 'batchId'), statementReference: value(data, 'statementReference'),
      amount: number(data, 'amount'), notes: value(data, 'notes'),
    })
    if (!parsed.success) return invalid(parsed)
    return parsed.data
  }, async (input, actor) => {
    const result = await addStatementEntry(input, actor.id)
    return result.matched
      ? 'Statement entry exactly matched a recorded payment or ticket sale.'
      : 'Statement entry saved unmatched. Verify the reference and amount before closing the batch.'
  }, 'Statement entry exactly matched a recorded payment.')
}

export async function closeReconciliationAction(_state: FinanceActionState, form: FormData) {
  return execute('finance:manage', form, (data) => {
    const batchId = value(data, 'batchId')
    if (!batchId) throw new FinanceOperationsError('Choose a reconciliation batch.')
    return batchId
  }, (batchId, actor) => closeReconciliation(batchId, actor.id), 'Reconciliation completed.')
}
