export class FinanceRuleError extends Error {}

export function calculateTicketTotal(price: number, quantity: number) {
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new FinanceRuleError('Ticket price and quantity must be valid whole numbers.')
  }
  const total = price * quantity
  if (!Number.isSafeInteger(total) || total > 2_147_483_647) {
    throw new FinanceRuleError('Ticket total exceeds the supported database amount.')
  }
  return total
}

export function validateRefund(totalAmount: number, refundedAmount: number, requestedAmount: number) {
  if (![totalAmount, refundedAmount, requestedAmount].every(Number.isSafeInteger)
    || totalAmount < 0 || refundedAmount < 0 || requestedAmount <= 0
    || refundedAmount + requestedAmount > totalAmount) {
    throw new FinanceRuleError('Refund cannot exceed the remaining value of the ticket sale.')
  }
}

export function validateTicketCapacity(available: number | null, sold: number, requested: number) {
  if (available !== null && sold + requested > available) {
    throw new FinanceRuleError('This ticket type has insufficient remaining capacity.')
  }
}

export function selectExactPaymentMatch<T extends {
  id: string
  amount: number
  reference: string | null
}>(payments: readonly T[], reference: string, amount: number) {
  const matches = payments.filter((payment) => payment.reference === reference && payment.amount === amount)
  return matches.length === 1 ? matches[0] : null
}
