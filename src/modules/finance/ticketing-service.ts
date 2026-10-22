import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { lockRow } from '@/lib/row-lock'
import { financeOperationsRepository as repository } from './operations-repository'
import { calculateTicketTotal, FinanceRuleError, validateRefund, validateTicketCapacity } from './operations-rules'
import { FinanceOperationsError } from './operations-errors'

function mapError(error: unknown): never {
  if (error instanceof FinanceRuleError) throw new FinanceOperationsError(error.message)
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new FinanceOperationsError('A record with this reference already exists.')
  }
  throw error
}

export async function createTicketType(input: {
  showDateId: string; name: string; price: number; quantityAvailable: number | ''
}, actorId: string) {
  return repository.transaction(async (tx) => {
    if (!await repository.findShowDate(tx, input.showDateId)) throw new FinanceOperationsError('Choose a valid show date.')
    const ticketType = await repository.createTicketType(tx, {
      ...input, quantityAvailable: input.quantityAvailable === '' ? null : input.quantityAvailable,
    })
    await writeAuditLog(tx, {
      actorId, action: 'TICKET_TYPE_CREATED', entity: 'TicketType', entityId: ticketType.id,
      details: { showDateId: input.showDateId, price: input.price, quantityAvailable: input.quantityAvailable || null },
    })
    return ticketType
  }).catch(mapError)
}

export async function recordTicketSale(input: {
  ticketTypeId: string; quantity: number; buyerName: string; method: 'MPESA' | 'CASH' | 'OTHER'; reference: string
}, actorId: string) {
  return repository.transaction(async (tx) => {
    await lockRow(tx, 'TicketType', input.ticketTypeId)
    const type = await repository.findTicketType(tx, input.ticketTypeId)
    if (!type) throw new FinanceOperationsError('Ticket type not found.')
    const sold = await repository.countTicketSales(tx, type.id)
    validateTicketCapacity(type.quantityAvailable, sold._sum.quantity ?? 0, input.quantity)
    const totalAmount = calculateTicketTotal(type.price, input.quantity)
    const sale = await repository.createTicketSale(tx, {
      ticketTypeId: type.id, quantity: input.quantity, unitPrice: type.price, totalAmount,
      buyerName: input.buyerName || null, method: input.method, reference: input.reference || null,
      recordedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'TICKET_SALE_RECORDED', entity: 'TicketSale', entityId: sale.id,
      details: { ticketTypeId: type.id, quantity: input.quantity, totalAmount, method: input.method },
    })
    return sale
  }).catch(mapError)
}

export async function refundTicket(input: { ticketSaleId: string; amount: number; reason: string }, actorId: string) {
  return repository.transaction(async (tx) => {
    await lockRow(tx, 'TicketSale', input.ticketSaleId)
    const sale = await repository.findTicketSale(tx, input.ticketSaleId)
    if (!sale) throw new FinanceOperationsError('Ticket sale not found.')
    const refunded = sale.refunds.reduce((sum, refund) => sum + refund.amount, 0)
    validateRefund(sale.totalAmount, refunded, input.amount)
    const refund = await repository.createTicketRefund(tx, { ...input, recordedById: actorId })
    await writeAuditLog(tx, {
      actorId, action: 'TICKET_REFUND_RECORDED', entity: 'TicketRefund', entityId: refund.id,
      details: { ticketSaleId: sale.id, amount: input.amount },
    })
    return refund
  }).catch(mapError)
}

export async function addGuestEntry(input: { showDateId: string; ticketSaleId: string; name: string; note: string }, actorId: string) {
  return repository.transaction(async (tx) => {
    if (!await repository.findShowDate(tx, input.showDateId)) throw new FinanceOperationsError('Choose a valid show date.')
    if (input.ticketSaleId && !await repository.findTicketSaleForShow(tx, input.ticketSaleId, input.showDateId)) {
      throw new FinanceOperationsError('Choose a ticket sale for this show.')
    }
    const entry = await repository.createGuestEntry(tx, {
      ...input, ticketSaleId: input.ticketSaleId || null, note: input.note || null, addedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'GUEST_LIST_ENTRY_ADDED', entity: 'GuestListEntry', entityId: entry.id,
      details: { showDateId: input.showDateId },
    })
    return entry
  }).catch(mapError)
}
