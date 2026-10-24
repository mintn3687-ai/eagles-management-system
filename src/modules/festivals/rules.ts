export type FestivalEntryStatus = 'PENDING' | 'PREPARING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'
export type FestivalInvitationStatus = 'RECEIVED' | 'ACCEPTED' | 'DECLINED'
export type FestivalBudgetType = 'INCOME' | 'EXPENSE'
export type FestivalLogisticsStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'

export const festivalLogisticsCategories = [
  'TRANSPORT',
  'ACCOMMODATION',
  'MEALS',
  'SCHEDULE',
  'VENUE',
  'CONTACTS',
  'EQUIPMENT',
  'COSTUMES',
  'PROPS',
  'PARTICIPANTS',
  'OTHER',
] as const

export class FestivalApprovalRuleError extends Error {}

const entryTransitions: Record<FestivalEntryStatus, FestivalEntryStatus[]> = {
  PENDING: ['PREPARING', 'SUBMITTED'],
  PREPARING: ['SUBMITTED'],
  SUBMITTED: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: [],
  REJECTED: [],
}

export function canTransitionEntry(from: FestivalEntryStatus, to: FestivalEntryStatus) {
  return entryTransitions[from].includes(to)
}

export function isEntryOverdue(status: FestivalEntryStatus, deadline: string | null, today: string) {
  return Boolean(deadline && deadline < today && (status === 'PENDING' || status === 'PREPARING'))
}

export function isInvitationOverdue(status: FestivalInvitationStatus, deadline: string | null, today: string) {
  return Boolean(deadline && deadline < today && status === 'RECEIVED')
}

export function isFestivalLogisticsOverdue(status: FestivalLogisticsStatus, dueAt: string | null, today: string) {
  return Boolean(dueAt && dueAt < today && status !== 'COMPLETED')
}

export function sumLinkedFinanceAmounts(amounts: number[]) {
  return amounts.reduce((total, amount) => total + amount, 0)
}

export function summarizeFestivalBudget(items: Array<{
  type: FestivalBudgetType
  plannedAmount: number
  approvedAmount?: number | null
  actualAmount: number
}>) {
  return items.reduce((totals, item) => {
    totals[item.type].planned += item.plannedAmount
    totals[item.type].approved += item.approvedAmount ?? 0
    totals[item.type].actual += item.actualAmount
    return totals
  }, {
    INCOME: { planned: 0, approved: 0, actual: 0 },
    EXPENSE: { planned: 0, approved: 0, actual: 0 },
  })
}

export function validateBudgetApprovalAmount(requestedAmount: number, approvedAmount: number | null, reason: string) {
  if (approvedAmount === null || !Number.isSafeInteger(approvedAmount) || approvedAmount <= 0) {
    throw new FestivalApprovalRuleError('Enter a positive approved amount.')
  }
  if (approvedAmount > requestedAmount) {
    throw new FestivalApprovalRuleError('Approved amount cannot exceed the requested amount.')
  }
  if (approvedAmount < requestedAmount && reason.trim().length < 5) {
    throw new FestivalApprovalRuleError('Explain why the requested amount was reduced.')
  }
}
