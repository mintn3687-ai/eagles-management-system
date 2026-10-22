import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findForUpdate: vi.fn(),
  isEligibleVoter: vi.fn(),
  hasVoted: vi.fn(),
  createReceipts: vi.fn(),
  createBallot: vi.fn(),
  createChoices: vi.fn(),
  updateLifecycle: vi.fn(),
  lockRow: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/elections/repository', () => ({
  electionsRepository: {
    transaction: mocks.transaction,
    findForUpdate: mocks.findForUpdate,
    isEligibleVoter: mocks.isEligibleVoter,
    hasVoted: mocks.hasVoted,
    createReceipts: mocks.createReceipts,
    createBallot: mocks.createBallot,
    createChoices: mocks.createChoices,
    updateLifecycle: mocks.updateLifecycle,
  },
}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import {
  ElectionServiceError,
  publishElectionResults,
  submitBallot,
} from '../src/modules/elections/service'

const election = {
  id: 'c123456789012345678901234',
  status: 'VOTING_OPEN',
  votingOpenedAt: new Date(Date.now() - 60_000),
  requireActiveMember: true,
  requireFeesCurrent: false,
  offices: [{
    id: 'c123456789012345678901235',
    nominations: [{ id: 'c123456789012345678901236', status: 'APPROVED' }],
  }],
}

const ballot = {
  electionId: election.id,
  choices: [{
    officeId: election.offices[0].id,
    choiceType: 'CANDIDATE' as const,
    nominationId: election.offices[0].nominations[0].id,
  }],
}

describe('secret ballot service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.findForUpdate.mockResolvedValue(election)
    mocks.isEligibleVoter.mockResolvedValue({ id: 'eligible-voter' })
    mocks.hasVoted.mockResolvedValue(null)
    mocks.createReceipts.mockResolvedValue({ count: 1 })
    mocks.createBallot.mockResolvedValue({ id: 'anonymous-ballot-id' })
    mocks.createChoices.mockResolvedValue({ count: 1 })
    mocks.updateLifecycle.mockResolvedValue(undefined)
  })

  it('stores a voter receipt and anonymous choices through separate records', async () => {
    await expect(submitBallot(ballot, 'member-id')).resolves.toEqual({ submitted: true })
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'Election', election.id)
    expect(mocks.createReceipts).toHaveBeenCalledWith({}, election.id, 'member-id', [election.offices[0].id])
    expect(mocks.createBallot).toHaveBeenCalledWith({}, election.id)
    expect(mocks.createChoices).toHaveBeenCalledWith({}, 'anonymous-ballot-id', [{
      officeId: election.offices[0].id,
      choiceType: 'CANDIDATE',
      nominationId: election.offices[0].nominations[0].id,
    }])
    expect(mocks.createReceipts.mock.calls[0]).not.toContain('anonymous-ballot-id')
  })

  it('rejects voting outside the open lifecycle window', async () => {
    mocks.findForUpdate.mockResolvedValue({ ...election, status: 'CLOSED' })
    await expect(submitBallot(ballot, 'member-id')).rejects.toThrow(/not currently open/)
    expect(mocks.createReceipts).not.toHaveBeenCalled()
  })

  it('rejects an ineligible voter before creating a receipt or ballot', async () => {
    mocks.isEligibleVoter.mockResolvedValue(null)
    await expect(submitBallot(ballot, 'outsider-id')).rejects.toThrow(/frozen eligible-voter register/)
    expect(mocks.createBallot).not.toHaveBeenCalled()
  })

  it('rejects a second vote for the same election', async () => {
    mocks.hasVoted.mockResolvedValue({ id: 'existing-receipt' })
    await expect(submitBallot(ballot, 'member-id')).rejects.toThrow(ElectionServiceError)
    expect(mocks.createReceipts).not.toHaveBeenCalled()
    expect(mocks.createBallot).not.toHaveBeenCalled()
  })

  it('maps a database uniqueness race to a duplicate-vote error', async () => {
    mocks.createReceipts.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: 'test',
    }))
    await expect(submitBallot(ballot, 'member-id')).rejects.toThrow(/already been submitted/)
    expect(mocks.createBallot).not.toHaveBeenCalled()
  })

  it('prevents a candidate from approving and publishing their own results', async () => {
    mocks.findForUpdate.mockResolvedValue({
      ...election,
      status: 'CLOSED',
      offices: [{
        ...election.offices[0],
        nominations: [{ ...election.offices[0].nominations[0], member: { userId: 'candidate-user' } }],
      }],
    })
    await expect(publishElectionResults(election.id, 'candidate-user')).rejects.toThrow(/candidate cannot approve/)
    expect(mocks.updateLifecycle).not.toHaveBeenCalled()
  })

  it('rejects an incomplete ballot and a nomination that is not approved for that office', async () => {
    await expect(submitBallot({ ...ballot, choices: [] }, 'member-id')).rejects.toThrow(/exactly one choice/)
    const invalidCandidate = {
      ...ballot,
      choices: [{ ...ballot.choices[0], nominationId: 'c123456789012345678901238' }],
    }
    await expect(submitBallot(invalidCandidate, 'member-id')).rejects.toThrow(/approved candidate/)
    expect(mocks.createReceipts).not.toHaveBeenCalled()
  })
})
