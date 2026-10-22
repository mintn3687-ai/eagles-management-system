import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import { ballotSchema, electionCreateSchema } from '../src/modules/elections/schema'
import {
  ElectionRuleError,
  resolveElectionTally,
  selectEligibleVoters,
  validateElectionTransition,
} from '../src/modules/elections/rules'

describe('election rules and schemas', () => {
  it('allows only forward lifecycle transitions', () => {
    expect(() => validateElectionTransition('DRAFT', 'NOMINATIONS_OPEN')).not.toThrow()
    expect(() => validateElectionTransition('NOMINATIONS_OPEN', 'VOTING_OPEN')).not.toThrow()
    expect(() => validateElectionTransition('VOTING_OPEN', 'CLOSED')).not.toThrow()
    expect(() => validateElectionTransition('CLOSED', 'RESULTS_PUBLISHED')).not.toThrow()
    expect(() => validateElectionTransition('VOTING_OPEN', 'RESULTS_PUBLISHED')).toThrow(ElectionRuleError)
  })

  it('freezes eligibility according to active-season and fee rules', () => {
    const members = [
      { memberId: 'active-paid', status: 'ACTIVE', feesOwed: 100, feesPaid: 100 },
      { memberId: 'active-due', status: 'ACTIVE', feesOwed: 200, feesPaid: 100 },
      { memberId: 'inactive-paid', status: 'INACTIVE', feesOwed: 0, feesPaid: 0 },
    ]
    expect(selectEligibleVoters(members, { requireActiveMember: true, requireFeesCurrent: true }).map((row) => row.memberId))
      .toEqual(['active-paid'])
    expect(selectEligibleVoters(members, { requireActiveMember: true, requireFeesCurrent: false }).map((row) => row.memberId))
      .toEqual(['active-paid', 'active-due'])
    expect(selectEligibleVoters(members, { requireActiveMember: false, requireFeesCurrent: true }).map((row) => row.memberId))
      .toEqual(['active-paid', 'inactive-paid'])
  })

  it('handles ties according to the office tie rule and tallies abstentions separately', () => {
    const office = {
      officeId: 'office-id', title: 'Chair', candidates: [
        { nominationId: 'candidate-1', name: 'One', votes: 3 },
        { nominationId: 'candidate-2', name: 'Two', votes: 3 },
      ],
      abstentions: 2, noneOfTheAbove: 1,
    }
    const noWinner = resolveElectionTally({ ...office, tieRule: 'NO_WINNER' })
    expect(noWinner.tied).toBe(true)
    expect(noWinner.winners).toEqual([])
    expect(noWinner.totalChoices).toBe(9)
    const coWinners = resolveElectionTally({ ...office, tieRule: 'CO_WINNERS' })
    expect(coWinners.winners.map((winner) => winner.name)).toEqual(['One', 'Two'])
    const rejected = resolveElectionTally({
      officeId: 'office-id', title: 'Chair', tieRule: 'CO_WINNERS',
      candidates: [{ nominationId: 'candidate', name: 'One', votes: 2 }],
      abstentions: 0, noneOfTheAbove: 3,
    })
    expect(rejected.noneOfTheAboveWins).toBe(true)
    expect(rejected.winners).toEqual([])
    expect(resolveElectionTally({
      officeId: 'office-id', title: 'Chair', tieRule: 'NO_WINNER', candidates: [], abstentions: 0, noneOfTheAbove: 0,
    }).winners).toEqual([])
  })

  it('validates unique offices and exactly one well-formed choice per office', () => {
    const election = {
      title: 'Annual election', description: '',
      requireActiveMember: true, requireFeesCurrent: false,
      offices: [{ title: 'Chair', tieRule: 'NO_WINNER' }, { title: 'Treasurer', tieRule: 'CO_WINNERS' }],
    }
    expect(electionCreateSchema.safeParse(election).success).toBe(true)
    expect(electionCreateSchema.safeParse({ ...election, offices: [election.offices[0], { ...election.offices[0], title: ' chair ' }] }).success).toBe(false)
    expect(ballotSchema.safeParse({
      electionId: 'c123456789012345678901234',
      choices: [
        { officeId: 'c123456789012345678901235', choiceType: 'CANDIDATE', nominationId: 'c123456789012345678901236' },
        { officeId: 'c123456789012345678901237', choiceType: 'ABSTAIN' },
      ],
    }).success).toBe(true)
    expect(ballotSchema.safeParse({
      electionId: 'c123456789012345678901234',
      choices: [{ officeId: 'c123456789012345678901235', choiceType: 'ABSTAIN', nominationId: 'c123456789012345678901236' }],
    }).success).toBe(false)
  })

  it('grants election management to staff and voting permission to all signed-in roles', () => {
    expect(hasPermission('MEMBER', 'elections:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'elections:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'elections:manage')).toBe(true)
    expect(hasPermission('MEMBER', 'elections:vote')).toBe(true)
  })
})
