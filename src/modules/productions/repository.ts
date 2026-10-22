import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const productionsRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),

  currentSeason: (tx: Transaction) => tx.season.findFirst({ where: { isCurrent: true }, select: { id: true } }),

  createProduction: (tx: Transaction, input: {
    title: string
    description: string
    startDate: Date | null
    endDate: Date | null
    seasonId: string | null
    createdById: string
  }) => tx.production.create({ data: input, select: { id: true, title: true } }),

  findProduction: (tx: Transaction, productionId: string) =>
    tx.production.findUnique({ where: { id: productionId }, select: { id: true, status: true, title: true } }),

  updateProductionStatus: (tx: Transaction, productionId: string, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') =>
    tx.production.update({ where: { id: productionId }, data: { status } }),

  createScriptVersion: (tx: Transaction, input: {
    productionId: string; version: string; usageRightsNotes: string; storageReference: string; createdById: string
  }) => tx.scriptVersion.create({ data: { ...input, storageReference: input.storageReference || null } }),

  createRole: (tx: Transaction, input: { productionId: string; name: string; description: string }) =>
    tx.productionRole.create({ data: { ...input, description: input.description || null } }),

  findRole: (tx: Transaction, productionId: string, roleId: string) =>
    tx.productionRole.findFirst({ where: { id: roleId, productionId }, select: { id: true } }),

  createCasting: (tx: Transaction, input: { roleId: string; memberId: string; type: 'CAST' | 'UNDERSTUDY' }) =>
    tx.casting.create({ data: input }),

  createCrewAssignment: (tx: Transaction, input: { productionId: string; memberId: string; assignment: string }) =>
    tx.crewAssignment.create({ data: input }),

  isCurrentActiveMember: (tx: Transaction, memberId: string) => tx.seasonMembership.findFirst({
    where: { memberId, status: 'ACTIVE', season: { isCurrent: true } }, select: { memberId: true },
  }),

  createTask: (tx: Transaction, input: {
    productionId: string; title: string; description: string; ownerMemberId: string | null;
    deadline: Date | null; createdById: string
  }) => tx.productionTask.create({ data: { ...input, description: input.description || null } }),

  findTask: (tx: Transaction, productionId: string, taskId: string) =>
    tx.productionTask.findFirst({ where: { id: taskId, productionId }, select: { id: true, status: true } }),

  updateTaskStatus: (tx: Transaction, taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
    tx.productionTask.update({ where: { id: taskId }, data: { status } }),

  createShowDate: (tx: Transaction, input: {
    productionId: string; startsAt: Date; venue: string; createdById: string
  }) => tx.showDate.create({ data: input }),

  findShowDate: (tx: Transaction, productionId: string, showDateId: string) =>
    tx.showDate.findFirst({ where: { id: showDateId, productionId }, select: { id: true } }),

  eligibleMembers: (tx: Transaction, memberIds: string[]) => tx.seasonMembership.findMany({
    where: { memberId: { in: memberIds }, status: 'ACTIVE', season: { isCurrent: true } },
    select: { memberId: true },
  }),

  createCallSheet: (tx: Transaction, input: {
    showDateId: string; title: string; callAt: Date; notes: string; createdById: string; memberIds: string[]
  }) => tx.callSheet.create({
    data: {
      showDateId: input.showDateId, title: input.title, callAt: input.callAt,
      notes: input.notes || null, createdById: input.createdById,
      members: { create: input.memberIds.map((memberId) => ({ memberId })) },
    },
  }),

  createAsset: (tx: Transaction, input: {
    productionId: string | null; name: string; category: 'PROP' | 'COSTUME' | 'EQUIPMENT' | 'OTHER';
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR'; updatedById: string
  }) => tx.asset.create({ data: input }),

  findAsset: (tx: Transaction, assetId: string) => tx.asset.findUnique({
    where: { id: assetId }, select: { id: true, name: true, status: true, currentHolderMemberId: true },
  }),

  moveAsset: (tx: Transaction, assetId: string, input: {
    status: 'AVAILABLE' | 'CHECKED_OUT'; currentHolderMemberId: string | null; updatedById: string
  }) => tx.asset.update({ where: { id: assetId }, data: input }),

  createPostShowNote: (tx: Transaction, input: {
    productionId: string; showDateId: string | null; note: string; createdById: string
  }) => tx.postShowNote.create({ data: input }),

  linkRehearsal: (tx: Transaction, rehearsalId: string, productionId: string | null) =>
    tx.rehearsal.update({ where: { id: rehearsalId }, data: { productionId } }),

  findRehearsal: (tx: Transaction, rehearsalId: string) =>
    tx.rehearsal.findUnique({ where: { id: rehearsalId }, select: { id: true, status: true, productionId: true } }),

  listProductions: () => prisma.production.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: { id: true, title: true, status: true, startDate: true, endDate: true, _count: { select: { showDates: true, tasks: true } } },
  }),

  productionDetail: (productionId: string) => prisma.production.findUnique({
    where: { id: productionId },
    include: {
      scriptVersions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      roles: { orderBy: [{ name: 'asc' }, { id: 'asc' }], include: { castings: { include: { member: { select: { id: true, fullName: true } } } } } },
      crew: { orderBy: [{ assignment: 'asc' }, { id: 'asc' }], include: { member: { select: { id: true, fullName: true } } } },
      tasks: { orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }], include: { owner: { select: { id: true, fullName: true } } } },
      rehearsals: { orderBy: [{ date: 'asc' }, { id: 'asc' }], select: { id: true, title: true, date: true, status: true } },
      showDates: { orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], include: {
        callSheets: { orderBy: [{ callAt: 'asc' }], include: { members: { include: { member: { select: { id: true, fullName: true } } } } } },
        postShowNotes: { orderBy: [{ createdAt: 'desc' }] },
      } },
      assets: { where: { status: { not: 'RETIRED' } }, orderBy: [{ name: 'asc' }], include: { currentHolder: { select: { id: true, fullName: true } } } },
      postShowNotes: { where: { showDateId: null }, orderBy: [{ createdAt: 'desc' }] },
    },
  }),

  activeMembers: () => prisma.seasonMembership.findMany({
    where: { status: 'ACTIVE', season: { isCurrent: true } },
    orderBy: [{ member: { fullName: 'asc' } }, { memberId: 'asc' }],
    take: 300,
    select: { memberId: true, member: { select: { fullName: true } } },
  }),

  listAssets: () => prisma.asset.findMany({
    where: { status: { not: 'RETIRED' } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 300,
    select: {
      id: true, name: true, status: true, category: true, condition: true,
      production: { select: { id: true, title: true } },
      currentHolder: { select: { fullName: true } },
    },
  }),

  availableRehearsals: () => prisma.rehearsal.findMany({
    where: { productionId: null, status: { in: ['SCHEDULED', 'OPEN'] } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    take: 100,
    select: { id: true, title: true, date: true, status: true },
  }),

  memberCallSheets: (memberId: string) => prisma.callSheetMember.findMany({
    where: {
      memberId,
      member: { seasonMemberships: { some: { status: 'ACTIVE', season: { isCurrent: true } } } },
      callSheet: { showDate: { startsAt: { gte: new Date() }, production: { status: 'ACTIVE' } } },
    },
    orderBy: [{ callSheet: { callAt: 'asc' } }, { id: 'asc' }],
    take: 100,
    select: {
      note: true,
      callSheet: { select: { id: true, title: true, callAt: true, notes: true, showDate: { select: { startsAt: true, venue: true, production: { select: { id: true, title: true } } } } } },
    },
  }),
}
