import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { createFrozenSnapshot } from '@/lib/frozen-snapshot'
import { lockRow } from '@/lib/row-lock'
import { electionsRepository } from './repository'
import type { BallotInput, ElectionCreateInput } from './schema'
import { ElectionRuleError, resolveElectionTally, selectEligibleVoters, validateElectionTransition } from './rules'

export class ElectionServiceError extends Error {}

async function electionForUpdate(tx: Prisma.TransactionClient, electionId: string) {
  await lockRow(tx, 'Election', electionId)
  const election = await electionsRepository.findForUpdate(tx, electionId)
  if (!election) throw new ElectionServiceError('Election not found.')
  return election
}

function translateRule(error: unknown): never {
  if (error instanceof ElectionRuleError) throw new ElectionServiceError(error.message)
  throw error
}

export async function createElection(input: ElectionCreateInput, actorId: string) {
  return electionsRepository.transaction(async (tx) => {
    const election = await electionsRepository.create(tx, {
      ...input,
      createdById: actorId,
      offices: input.offices.map((office, sortOrder) => ({ ...office, sortOrder })),
    })
    await writeAuditLog(tx, {
      actorId, action: 'ELECTION_CREATED', entity: 'Election', entityId: election.id,
      details: { officeCount: input.offices.length, requireActiveMember: input.requireActiveMember, requireFeesCurrent: input.requireFeesCurrent },
    })
    return election
  })
}

export async function openNominations(electionId: string, actorId: string) {
  try {
    return await electionsRepository.transaction(async (tx) => {
      const election = await electionForUpdate(tx, electionId)
      validateElectionTransition(election.status, 'NOMINATIONS_OPEN')
      if (!election.offices.length) throw new ElectionServiceError('Add at least one office before opening nominations.')
      const openedAt = new Date()
      await electionsRepository.updateLifecycle(tx, electionId, { status: 'NOMINATIONS_OPEN', nominationsOpenedAt: openedAt })
      await writeAuditLog(tx, {
        actorId, action: 'ELECTION_NOMINATIONS_OPENED', entity: 'Election', entityId: electionId,
        details: { openedAt: openedAt.toISOString() },
      })
      return { openedAt }
    })
  } catch (error) {
    translateRule(error)
  }
}

export async function openVoting(electionId: string, actorId: string) {
  try {
    return await electionsRepository.transaction(async (tx) => {
      const election = await electionForUpdate(tx, electionId)
      validateElectionTransition(election.status, 'VOTING_OPEN')
      if (election.offices.some((office) => !office.nominations.some((nomination) => nomination.status === 'APPROVED'))) {
        throw new ElectionServiceError('Approve at least one candidate for every office before voting opens.')
      }
      if (election.offices.some((office) => office.nominations.some((nomination) => nomination.status === 'PENDING'))) {
        throw new ElectionServiceError('Review all pending nominations before voting opens.')
      }
      const members = await electionsRepository.listCurrentMemberships(tx)
      const eligible = selectEligibleVoters(members, election)
      if (!eligible.length) throw new ElectionServiceError('No members meet this election’s eligibility rules.')
      const snapshot = createFrozenSnapshot(eligible.map((member) => ({
        id: member.memberId, status: member.status, roleInSeason: 'VOTER',
      })))
      const openedAt = new Date()
      await electionsRepository.createVoterSnapshot(tx, electionId, eligible.map((member) => member.memberId))
      await electionsRepository.updateLifecycle(tx, electionId, {
        status: 'VOTING_OPEN', votingOpenedAt: openedAt,
        eligibleVoterCount: snapshot.count, eligibilitySnapshotHash: snapshot.hash,
      })
      await writeAuditLog(tx, {
        actorId, action: 'ELECTION_VOTING_OPENED', entity: 'Election', entityId: electionId,
        details: { openedAt: openedAt.toISOString(), eligibleVoterCount: snapshot.count, eligibilitySnapshotHash: snapshot.hash },
      })
      return { openedAt, eligibleVoterCount: snapshot.count }
    })
  } catch (error) {
    translateRule(error)
  }
}

export async function closeVoting(electionId: string, actorId: string) {
  try {
    return await electionsRepository.transaction(async (tx) => {
      const election = await electionForUpdate(tx, electionId)
      validateElectionTransition(election.status, 'CLOSED')
      const closedAt = new Date()
      await electionsRepository.updateLifecycle(tx, electionId, { status: 'CLOSED', closedAt })
      const turnout = await electionsRepository.countVoters(tx, electionId)
      await writeAuditLog(tx, {
        actorId, action: 'ELECTION_CLOSED', entity: 'Election', entityId: electionId,
        details: { closedAt: closedAt.toISOString(), turnout },
      })
      return { closedAt, turnout }
    })
  } catch (error) {
    translateRule(error)
  }
}

export async function publishElectionResults(electionId: string, actorId: string) {
  try {
    return await electionsRepository.transaction(async (tx) => {
      const election = await electionForUpdate(tx, electionId)
      validateElectionTransition(election.status, 'RESULTS_PUBLISHED')
      if (election.offices.some((office) => office.nominations.some((nomination) => nomination.member.userId === actorId))) {
        throw new ElectionServiceError('A candidate cannot approve or publish their own election results.')
      }
      const approvedAt = new Date()
      await electionsRepository.updateLifecycle(tx, electionId, {
        status: 'RESULTS_PUBLISHED',
        resultsApprovedBy: { connect: { id: actorId } },
        resultsApprovedAt: approvedAt,
        resultsPublishedAt: approvedAt,
      })
      await writeAuditLog(tx, {
        actorId, action: 'ELECTION_RESULTS_PUBLISHED', entity: 'Election', entityId: electionId,
        details: { approvedAt: approvedAt.toISOString() },
      })
      return { publishedAt: approvedAt }
    })
  } catch (error) {
    translateRule(error)
  }
}

export async function submitNomination(electionId: string, officeId: string, memberId: string, actorId: string) {
  return electionsRepository.transaction(async (tx) => {
    const election = await electionForUpdate(tx, electionId)
    if (election.status !== 'NOMINATIONS_OPEN') throw new ElectionServiceError('Nominations are not open.')
    if (!election.offices.some((office) => office.id === officeId)) throw new ElectionServiceError('That office is not part of this election.')
    if (!await electionsRepository.isCurrentActiveMember(tx, memberId)) {
      throw new ElectionServiceError('Only active members in the current season may nominate themselves.')
    }
    try {
      const nomination = await electionsRepository.createNomination(tx, { electionId, officeId, memberId })
      await writeAuditLog(tx, {
        actorId, action: 'ELECTION_NOMINATION_SUBMITTED', entity: 'Nomination', entityId: nomination.id,
        details: { electionId, officeId },
      })
      return nomination
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ElectionServiceError('You already have a nomination for this office.')
      }
      throw error
    }
  })
}

export async function reviewNomination(
  electionId: string,
  nominationId: string,
  status: 'APPROVED' | 'REJECTED',
  actorId: string,
) {
  return electionsRepository.transaction(async (tx) => {
    const election = await electionForUpdate(tx, electionId)
    if (election.status !== 'NOMINATIONS_OPEN') throw new ElectionServiceError('Nominations can only be reviewed while nominations are open.')
    const nomination = await electionsRepository.findNomination(tx, electionId, nominationId)
    if (!nomination) throw new ElectionServiceError('Nomination not found.')
    if (nomination.status !== 'PENDING') throw new ElectionServiceError('This nomination has already been reviewed.')
    const reviewedAt = new Date()
    await electionsRepository.reviewNomination(tx, nominationId, status, actorId, reviewedAt)
    await writeAuditLog(tx, {
      actorId, action: 'ELECTION_NOMINATION_REVIEWED', entity: 'Nomination', entityId: nominationId,
      details: { electionId, status },
    })
    return { status }
  })
}

export async function submitBallot(input: BallotInput, memberId: string) {
  try {
    return await electionsRepository.transaction(async (tx) => {
      const election = await electionForUpdate(tx, input.electionId)
      const now = new Date()
      if (election.status !== 'VOTING_OPEN' || !election.votingOpenedAt || election.votingOpenedAt > now) {
        throw new ElectionServiceError('Voting is not currently open.')
      }
      if (!await electionsRepository.isEligibleVoter(tx, election.id, memberId)) {
        throw new ElectionServiceError('You are not on this election’s frozen eligible-voter register.')
      }
      if (await electionsRepository.hasVoted(tx, election.id, memberId)) {
        throw new ElectionServiceError('A ballot has already been submitted for this election.')
      }
      const offices = new Map(election.offices.map((office) => [office.id, office]))
      if (input.choices.length !== offices.size || input.choices.some((choice) => !offices.has(choice.officeId))) {
        throw new ElectionServiceError('Submit exactly one choice for every office.')
      }
      for (const choice of input.choices) {
        if (choice.choiceType === 'CANDIDATE') {
          const candidate = offices.get(choice.officeId)?.nominations.find((row) =>
            row.id === choice.nominationId && row.status === 'APPROVED')
          if (!candidate) throw new ElectionServiceError('Choose an approved candidate for each selected office.')
        }
      }
      await electionsRepository.createReceipts(tx, election.id, memberId, input.choices.map((choice) => choice.officeId))
      const ballot = await electionsRepository.createBallot(tx, election.id)
      await electionsRepository.createChoices(tx, ballot.id, input.choices.map((choice) => ({
        officeId: choice.officeId,
        choiceType: choice.choiceType,
        nominationId: choice.choiceType === 'CANDIDATE' ? choice.nominationId! : null,
      })))
      return { submitted: true }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ElectionServiceError('A ballot has already been submitted for this election.')
    }
    throw error
  }
}

export async function getPublishedResults(electionId: string) {
  const input = await electionsRepository.getResultInput(electionId)
  if (!input) return null
  const offices = input.election.offices.map((office) => resolveElectionTally({
    officeId: office.id,
    title: office.title,
    tieRule: office.tieRule,
    candidates: office.nominations.map((nomination) => ({
      nominationId: nomination.id,
      name: nomination.member.fullName,
      votes: input.groupedChoices.find((group) =>
        group.officeId === office.id && group.choiceType === 'CANDIDATE' && group.nominationId === nomination.id)?._count._all ?? 0,
    })),
    abstentions: input.groupedChoices.find((group) => group.officeId === office.id && group.choiceType === 'ABSTAIN')?._count._all ?? 0,
    noneOfTheAbove: input.groupedChoices.find((group) => group.officeId === office.id && group.choiceType === 'NONE_OF_ABOVE')?._count._all ?? 0,
  }))
  return {
    title: input.election.title,
    eligibleVoterCount: input.election.eligibleVoterCount,
    turnout: input.turnout,
    turnoutPercent: input.election.eligibleVoterCount
      ? Math.round((input.turnout / input.election.eligibleVoterCount) * 100)
      : 0,
    offices,
  }
}
