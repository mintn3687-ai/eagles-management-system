import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const electionsRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),

  create: (tx: Transaction, input: {
    title: string
    description: string
    requireActiveMember: boolean
    requireFeesCurrent: boolean
    createdById: string
    offices: Array<{ title: string; tieRule: 'CO_WINNERS' | 'NO_WINNER'; sortOrder: number }>
  }) => tx.election.create({
    data: {
      title: input.title,
      description: input.description || null,
      requireActiveMember: input.requireActiveMember,
      requireFeesCurrent: input.requireFeesCurrent,
      createdById: input.createdById,
      offices: { create: input.offices },
    },
    select: { id: true, title: true },
  }),

  findForUpdate: (tx: Transaction, electionId: string) => tx.election.findUnique({
    where: { id: electionId },
    include: {
      offices: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          nominations: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: { member: { select: { id: true, fullName: true, userId: true } } },
          },
        },
      },
    },
  }),

  updateLifecycle: (tx: Transaction, electionId: string, data: Prisma.ElectionUpdateInput) =>
    tx.election.update({ where: { id: electionId }, data }),

  listCurrentMemberships: (tx: Transaction) => tx.seasonMembership.findMany({
    where: { season: { isCurrent: true } },
    orderBy: { memberId: 'asc' },
    select: { memberId: true, status: true, feesOwed: true, feesPaid: true },
  }),

  createVoterSnapshot: (tx: Transaction, electionId: string, memberIds: string[]) =>
    tx.eligibleVoter.createMany({ data: memberIds.map((memberId) => ({ electionId, memberId })) }),

  isCurrentActiveMember: (tx: Transaction, memberId: string) => tx.seasonMembership.findFirst({
    where: { memberId, season: { isCurrent: true }, status: 'ACTIVE' },
    select: { memberId: true },
  }),

  createNomination: (tx: Transaction, input: { electionId: string; officeId: string; memberId: string }) =>
    tx.nomination.create({ data: input, select: { id: true } }),

  findNomination: (tx: Transaction, electionId: string, nominationId: string) =>
    tx.nomination.findFirst({ where: { id: nominationId, electionId } }),

  reviewNomination: (tx: Transaction, nominationId: string, status: 'APPROVED' | 'REJECTED', reviewedById: string, reviewedAt: Date) =>
    tx.nomination.update({ where: { id: nominationId }, data: { status, reviewedById, reviewedAt } }),

  isEligibleVoter: (tx: Transaction, electionId: string, memberId: string) =>
    tx.eligibleVoter.findUnique({ where: { electionId_memberId: { electionId, memberId } }, select: { id: true } }),

  hasVoted: (tx: Transaction, electionId: string, memberId: string) =>
    tx.voteReceipt.findFirst({ where: { electionId, memberId }, select: { id: true } }),

  createReceipts: (tx: Transaction, electionId: string, memberId: string, officeIds: string[]) =>
    tx.voteReceipt.createMany({ data: officeIds.map((officeId) => ({ electionId, memberId, officeId })) }),

  countVoters: async (tx: Transaction, electionId: string) =>
    (await tx.voteReceipt.groupBy({ by: ['memberId'], where: { electionId } })).length,

  countVotersForElection: async (electionId: string) =>
    (await prisma.voteReceipt.groupBy({ by: ['memberId'], where: { electionId } })).length,

  createBallot: (tx: Transaction, electionId: string) =>
    tx.ballot.create({ data: { electionId }, select: { id: true } }),

  createChoices: (tx: Transaction, ballotId: string, choices: Array<{
    officeId: string
    choiceType: 'CANDIDATE' | 'ABSTAIN' | 'NONE_OF_ABOVE'
    nominationId: string | null
  }>) => tx.ballotChoice.createMany({ data: choices.map((choice) => ({ ballotId, ...choice })) }),

  listAdminElections: async () => {
    const elections = await prisma.election.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true, title: true, status: true, createdAt: true,
        _count: { select: { offices: true, eligibleVoters: true } },
      },
    })
    const receiptMembers = await prisma.voteReceipt.groupBy({
      by: ['electionId', 'memberId'],
      where: { electionId: { in: elections.map((election) => election.id) } },
    })
    const turnoutByElection = new Map<string, number>()
    for (const row of receiptMembers) turnoutByElection.set(row.electionId, (turnoutByElection.get(row.electionId) ?? 0) + 1)
    return elections.map((election) => ({ ...election, turnoutCount: turnoutByElection.get(election.id) ?? 0 }))
  },

  findAdminElection: (electionId: string) => prisma.election.findUnique({
    where: { id: electionId },
    include: {
      offices: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { nominations: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { member: { select: { id: true, fullName: true } } },
        } },
      },
      _count: { select: { eligibleVoters: true } },
    },
  }),

  listMemberElections: async (memberId: string) => {
    const elections = await prisma.election.findMany({
      where: { status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN', 'RESULTS_PUBLISHED'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true, title: true, description: true, status: true,
        offices: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: { id: true, title: true, nominations: {
            where: { status: 'APPROVED' },
            orderBy: [{ member: { fullName: 'asc' } }, { id: 'asc' }],
            select: { id: true, member: { select: { fullName: true } } },
          } },
        },
        voteReceipts: { where: { memberId }, take: 1, select: { id: true } },
        eligibleVoters: { where: { memberId }, select: { id: true } },
      },
    })
    const ownNominations = await prisma.nomination.findMany({
      where: { memberId, electionId: { in: elections.map((election) => election.id) } },
      select: { id: true, status: true, officeId: true },
    })
    const nominationsByOffice = new Map<string, typeof ownNominations>()
    for (const nomination of ownNominations) {
      nominationsByOffice.set(nomination.officeId, [...(nominationsByOffice.get(nomination.officeId) ?? []), nomination])
    }
    return elections.map((election) => ({
      ...election,
      offices: election.offices.map((office) => ({
        ...office,
        myNominations: nominationsByOffice.get(office.id) ?? [],
      })),
    }))
  },

  getResultInput: async (electionId: string) => {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true, title: true, status: true, eligibleVoterCount: true, offices: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { id: true, title: true, tieRule: true, nominations: {
          where: { status: 'APPROVED' },
          orderBy: [{ member: { fullName: 'asc' } }, { id: 'asc' }],
          select: { id: true, member: { select: { fullName: true } } },
        } },
      } },
    })
    if (!election || election.status !== 'RESULTS_PUBLISHED') return null
    const [turnoutRows, groupedChoices] = await Promise.all([
      prisma.voteReceipt.groupBy({ by: ['memberId'], where: { electionId } }),
      prisma.ballotChoice.groupBy({
        by: ['officeId', 'choiceType', 'nominationId'],
        where: { ballot: { electionId } },
        _count: { _all: true },
      }),
    ])
    return { election, turnout: turnoutRows.length, groupedChoices }
  },
}
