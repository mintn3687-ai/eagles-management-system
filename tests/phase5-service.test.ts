import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), findTicketType: vi.fn(), countTicketSales: vi.fn(),
  createTicketSale: vi.fn(), findTicketSale: vi.fn(), createTicketRefund: vi.fn(),
  lockRow: vi.fn(), writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/finance/operations-repository', () => ({
  financeOperationsRepository: {
    transaction: mocks.transaction,
    findTicketType: mocks.findTicketType,
    countTicketSales: mocks.countTicketSales,
    createTicketSale: mocks.createTicketSale,
    findTicketSale: mocks.findTicketSale,
    createTicketRefund: mocks.createTicketRefund,
  },
}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import { FinanceOperationsError } from '../src/modules/finance/operations-errors'
import { recordTicketSale, refundTicket } from '../src/modules/finance/ticketing-service'

const ticketTypeId = 'c123456789012345678901234'
const saleId = 'c123456789012345678901235'

describe('finance operation service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.findTicketType.mockResolvedValue({
      id: ticketTypeId, price: 500, quantityAvailable: 10,
      showDate: { id: 'show', startsAt: new Date(), productionId: 'production' },
    })
    mocks.countTicketSales.mockResolvedValue({ _sum: { quantity: 6 } })
    mocks.createTicketSale.mockResolvedValue({ id: saleId, totalAmount: 1500 })
    mocks.findTicketSale.mockResolvedValue({
      id: saleId, totalAmount: 1000, refunds: [{ amount: 300 }],
    })
    mocks.createTicketRefund.mockResolvedValue({ id: 'refund' })
  })

  it('locks ticket inventory, snapshots current price, computes total, and audits without buyer details', async () => {
    await expect(recordTicketSale({
      ticketTypeId, quantity: 3, buyerName: 'Buyer', method: 'CASH', reference: 'C-1',
    }, 'actor')).resolves.toEqual({ id: saleId, totalAmount: 1500 })
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'TicketType', ticketTypeId)
    expect(mocks.createTicketSale).toHaveBeenCalledWith({}, expect.objectContaining({
      quantity: 3, unitPrice: 500, totalAmount: 1500, recordedById: 'actor',
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'TICKET_SALE_RECORDED',
      details: expect.objectContaining({ totalAmount: 1500 }),
    }))
  })

  it('rejects sales above available capacity before recording revenue', async () => {
    mocks.countTicketSales.mockResolvedValue({ _sum: { quantity: 9 } })
    await expect(recordTicketSale({
      ticketTypeId, quantity: 2, buyerName: '', method: 'CASH', reference: '',
    }, 'actor')).rejects.toThrow(FinanceOperationsError)
    expect(mocks.createTicketSale).not.toHaveBeenCalled()
  })

  it('serializes refunds and rejects a refund exceeding the remaining sale value', async () => {
    await expect(refundTicket({ ticketSaleId: saleId, amount: 701, reason: 'Refund request' }, 'actor'))
      .rejects.toThrow(/remaining value/)
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'TicketSale', saleId)
    expect(mocks.createTicketRefund).not.toHaveBeenCalled()
  })
})
