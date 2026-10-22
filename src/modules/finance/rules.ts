import { nairobiDateKey } from '@/lib/dates'

export function isPaymentWithinSeason(paidAt: Date, startDate: Date, endDate: Date) {
  const paymentDay = nairobiDateKey(paidAt)
  return paymentDay >= nairobiDateKey(startDate) && paymentDay <= nairobiDateKey(endDate)
}
