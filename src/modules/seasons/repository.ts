import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const seasonsRepository = {
  findCurrent: () => prisma.season.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true, startDate: true, endDate: true },
  }),

  findCurrentInTransaction: (tx: Transaction) => tx.season.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  }),

  createMembershipsForCurrentSeason: (tx: Transaction, rows: Prisma.SeasonMembershipCreateManyInput[]) =>
    tx.seasonMembership.createMany({ data: rows, skipDuplicates: true }),

  updateCurrentMembershipStatus: (tx: Transaction, input: {
    seasonId: string
    memberId: string
    status: 'PENDING_REGISTRATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ALUMNI'
  }) => tx.seasonMembership.upsert({
    where: { seasonId_memberId: { seasonId: input.seasonId, memberId: input.memberId } },
    update: { status: input.status },
    create: {
      seasonId: input.seasonId,
      memberId: input.memberId,
      status: input.status,
      feesOwed: 0,
      feesPaid: 0,
    },
  }),

  findDateOverlaps: (tx: Transaction, startDate: Date, endDate: Date) => tx.season.findFirst({
    where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
    select: { id: true },
  }),

  countCurrentActiveMembers: () => prisma.seasonMembership.count({
    where: { season: { isCurrent: true }, status: 'ACTIVE' },
  }),

  listCurrentActiveMembers: (skip: number, take: number) => prisma.seasonMembership.findMany({
    where: { season: { isCurrent: true }, status: 'ACTIVE' },
    orderBy: [{ member: { fullName: 'asc' } }, { memberId: 'asc' }],
    skip,
    take,
    select: {
      memberId: true,
      status: true,
      member: { select: { fullName: true, user: { select: { role: true } } } },
    },
  }),

  createNextSeason: (tx: Transaction, input: {
    name: string
    startDate: Date
    endDate: Date
    snapshotHash: string
  }) => tx.season.create({
    data: {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: true,
      membershipSnapshotHash: input.snapshotHash,
    },
  }),

  listCurrentMembershipsForRollover: (tx: Transaction) => tx.seasonMembership.findMany({
    where: { season: { isCurrent: true } },
    orderBy: { memberId: 'asc' },
    select: {
      memberId: true,
      status: true,
      roleInSeason: true,
      member: { select: { fullName: true, userId: true, user: { select: { role: true } } } },
    },
  }),

  retireCurrentSeason: (tx: Transaction, seasonId: string) =>
    tx.season.update({ where: { id: seasonId }, data: { isCurrent: false } }),

  createMemberships: (tx: Transaction, rows: Prisma.SeasonMembershipCreateManyInput[]) =>
    tx.seasonMembership.createMany({ data: rows }),

  updateMemberStatus: (tx: Transaction, memberId: string, status: 'INACTIVE' | 'ALUMNI') =>
    tx.member.update({ where: { id: memberId }, data: { status } }),

  createStatusHistory: (tx: Transaction, memberId: string, status: 'INACTIVE' | 'ALUMNI', effectiveAt: Date) =>
    tx.memberStatusHistory.create({ data: { memberId, status, effectiveAt } }),

  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
}
