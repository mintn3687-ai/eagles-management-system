export function formatKES(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative whole number of Kenya shillings.')
  }
  return `KES ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(amount)}`
}
