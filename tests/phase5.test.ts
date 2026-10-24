import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import {
  budgetSchema, financeEntrySchema, ticketSaleSchema, ticketTypeSchema,
} from '../src/modules/finance/operations-schema'
import {
  calculateTicketTotal, FinanceRuleError, selectExactPaymentMatch,
  validateRefund, validateTicketCapacity,
} from '../src/modules/finance/operations-rules'

const id = 'c123456789012345678901234'
const uuid = '123e4567-e89b-12d3-a456-426614174000'

describe('finance validation and money rules', () => {
  it('accepts only positive whole-KES finance values and scoped budgets', () => {
    expect(budgetSchema.safeParse({
      seasonId: id, productionId: '', category: 'Costumes', amount: 1000, notes: '',
    }).success).toBe(true)
    expect(budgetSchema.safeParse({
      seasonId: '', productionId: '', category: 'Costumes', amount: 1000, notes: '',
    }).success).toBe(false)
    expect(budgetSchema.safeParse({
      seasonId: '', productionId: uuid, category: 'Costumes', amount: 1000, notes: '',
    }).success).toBe(true)
    expect(financeEntrySchema.safeParse({
      type: 'EXPENSE', seasonId: id, productionId: '', category: 'Travel', amount: 250,
      description: 'Transport receipts', receiptReference: 'RCPT-1', date: '2026-10-22',
    }).success).toBe(true)
    expect(financeEntrySchema.safeParse({
      type: 'INCOME', seasonId: id, productionId: '', category: 'Fees', amount: 0,
      description: 'Invalid free income', receiptReference: '', date: '2026-10-22',
    }).success).toBe(false)
  })

  it('calculates bounded ticket totals and rejects invalid quantities or database overflow', () => {
    expect(calculateTicketTotal(500, 3)).toBe(1500)
    expect(() => calculateTicketTotal(-1, 2)).toThrow(FinanceRuleError)
    expect(() => calculateTicketTotal(1_000_000_000, 3)).toThrow(/database amount/)
    expect(ticketSaleSchema.safeParse({
      ticketTypeId: id, quantity: 2, buyerName: '', method: 'CASH', reference: '',
    }).success).toBe(true)
    expect(ticketSaleSchema.safeParse({
      ticketTypeId: uuid, quantity: 2, buyerName: '', method: 'CASH', reference: '',
    }).success).toBe(true)
    expect(ticketTypeSchema.safeParse({
      showDateId: id, name: 'Standard', price: -1, quantityAvailable: '',
    }).success).toBe(false)
  })

  it('prevents partial or cumulative refunds above the amount originally collected', () => {
    expect(() => validateRefund(1000, 400, 600)).not.toThrow()
    expect(() => validateRefund(1000, 400, 601)).toThrow(/remaining value/)
    expect(() => validateRefund(1000, 1000, 1)).toThrow(FinanceRuleError)
  })

  it('enforces ticket capacity and only auto-matches one exact transaction', () => {
    expect(() => validateTicketCapacity(10, 7, 3)).not.toThrow()
    expect(() => validateTicketCapacity(10, 7, 4)).toThrow(/capacity/)
    const records = [
      { id: 'one', amount: 500, reference: 'REF-1' },
      { id: 'two', amount: 500, reference: 'REF-1' },
    ]
    expect(selectExactPaymentMatch(records, 'REF-1', 500)).toBeNull()
    expect(selectExactPaymentMatch(records.slice(0, 1), 'REF-1', 500)?.id).toBe('one')
    expect(selectExactPaymentMatch(records, 'REF-1', 501)).toBeNull()
  })

  it('allows finance operations only for committee roles and member reimbursement requests', () => {
    expect(hasPermission('MEMBER', 'finance:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'finance:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'finance:manage')).toBe(true)
    expect(hasPermission('MEMBER', 'reimbursements:request')).toBe(true)
    expect(hasPermission('COMMITTEE', 'fees:manage')).toBe(false)
    expect(hasPermission('SUPER_ADMIN', 'fees:manage')).toBe(true)
  })
})
