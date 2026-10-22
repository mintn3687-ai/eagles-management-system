import type { ElectionStatus, ElectionTieRule } from '@prisma/client'

export class ElectionRuleError extends Error {}

const nextStatus: Partial<Record<ElectionStatus, ElectionStatus>> = {
  DRAFT: 'NOMINATIONS_OPEN',
  NOMINATIONS_OPEN: 'VOTING_OPEN',
  VOTING_OPEN: 'CLOSED',
  CLOSED: 'RESULTS_PUBLISHED',
}

export function validateElectionTransition(from: ElectionStatus, to: ElectionStatus) {
  if (nextStatus[from] !== to) throw new ElectionRuleError('Election lifecycle transitions must happen in order.')
}

export function selectEligibleVoters<T extends {
  memberId: string
  status: string
  feesOwed: number
  feesPaid: number
}>(members: readonly T[], rules: { requireActiveMember: boolean; requireFeesCurrent: boolean }) {
  return members.filter((member) =>
    (!rules.requireActiveMember || member.status === 'ACTIVE')
    && (!rules.requireFeesCurrent || member.feesPaid >= member.feesOwed))
}

export type ElectionOfficeTally = {
  officeId: string
  title: string
  tieRule: ElectionTieRule
  candidates: Array<{ nominationId: string; name: string; votes: number }>
  abstentions: number
  noneOfTheAbove: number
}

export function resolveElectionTally(office: ElectionOfficeTally) {
  const highest = Math.max(0, ...office.candidates.map((candidate) => candidate.votes))
  const tied = highest > 0 ? office.candidates.filter((candidate) => candidate.votes === highest) : []
  const noneOfTheAboveWins = office.noneOfTheAbove > highest
  const noneOfTheAboveTie = office.noneOfTheAbove > 0 && office.noneOfTheAbove === highest
  const candidateTie = tied.length > 1
  const winners = noneOfTheAboveWins || noneOfTheAboveTie || (candidateTie && office.tieRule === 'NO_WINNER')
    ? []
    : tied
  return {
    ...office,
    winners,
    tied: candidateTie || noneOfTheAboveTie,
    candidateTie,
    noneOfTheAboveWins,
    noneOfTheAboveTie,
    totalChoices: office.candidates.reduce((sum, candidate) => sum + candidate.votes, 0)
      + office.abstentions + office.noneOfTheAbove,
  }
}
