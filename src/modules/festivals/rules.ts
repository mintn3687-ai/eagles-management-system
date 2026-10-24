export type FestivalEntryStatus = 'PENDING' | 'PREPARING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'
export type FestivalInvitationStatus = 'RECEIVED' | 'ACCEPTED' | 'DECLINED'

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
