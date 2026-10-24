import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sumLinkedFinanceAmounts } from './rules'
import type { FestivalEntryStatus } from './rules'

type Transaction = Prisma.TransactionClient

export const festivalsRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),

  list: () => prisma.festival.findMany({
    orderBy: [{ startDate: 'asc' }, { year: 'desc' }, { name: 'asc' }],
    take: 100,
  }),

  dashboardData: async (deadlineLimit: Date) => {
    const festivals = await prisma.festival.findMany({
      orderBy: [{ startDate: 'asc' }, { year: 'desc' }, { name: 'asc' }],
      take: 100,
      select: {
        id: true, name: true, year: true, status: true, startDate: true, endDate: true,
      },
    })
    const festivalIds = festivals
      .filter((festival) => festival.status !== 'COMPLETED' && festival.status !== 'CANCELLED')
      .map((festival) => festival.id)
    if (!festivalIds.length) {
      return {
        festivals,
        entries: [],
        entryCounts: [],
        invitations: [],
        logisticsItems: [],
        logisticsCounts: [],
        budgetItems: [],
        financeLinks: [],
        financeEntries: [],
        approvals: [],
      }
    }

    const [
      entries,
      entryCounts,
      invitations,
      logisticsItems,
      logisticsCounts,
      budgetItems,
      financeLinks,
      approvals,
    ] = await Promise.all([
      prisma.festivalEntry.findMany({
        where: {
          festivalId: { in: festivalIds },
          status: { in: ['PENDING', 'PREPARING'] },
          deadline: { lte: deadlineLimit },
        },
        orderBy: [{ deadline: 'asc' }, { id: 'asc' }],
        take: 300,
        select: { id: true, festivalId: true, itemTitle: true, status: true, deadline: true },
      }),
      prisma.festivalEntry.groupBy({
        by: ['festivalId', 'status'],
        where: { festivalId: { in: festivalIds } },
        _count: { _all: true },
      }),
      prisma.festivalInvitation.findMany({
        where: {
          festivalId: { in: festivalIds },
          status: 'RECEIVED',
          responseDeadline: { lte: deadlineLimit },
        },
        orderBy: [{ responseDeadline: 'asc' }, { id: 'asc' }],
        take: 300,
        select: { id: true, festivalId: true, responseDeadline: true },
      }),
      prisma.festivalLogisticsItem.findMany({
        where: {
          festivalId: { in: festivalIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { lte: deadlineLimit },
        },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 300,
        select: { id: true, festivalId: true, title: true, status: true, dueAt: true },
      }),
      prisma.festivalLogisticsItem.groupBy({
        by: ['festivalId', 'status'],
        where: { festivalId: { in: festivalIds } },
        _count: { _all: true },
      }),
      prisma.festivalBudgetItem.findMany({
        where: { festivalId: { in: festivalIds } },
        take: 10000,
        select: { id: true, festivalId: true, type: true, plannedAmount: true },
      }),
      prisma.festivalFinanceLink.findMany({
        where: { festivalId: { in: festivalIds } },
        select: { budgetItemId: true, financeEntryId: true },
      }),
      prisma.festivalApproval.findMany({
        where: { festivalId: { in: festivalIds } },
        take: 20000,
        select: {
          festivalId: true, budgetItemId: true, targetKey: true, type: true,
          status: true, approvedAmount: true,
        },
      }),
    ])
    const financeEntryIds = [...new Set(financeLinks.map((link) => link.financeEntryId))]
    const financeEntries = financeEntryIds.length
      ? await prisma.financeEntry.findMany({
        where: { id: { in: financeEntryIds } },
        select: { id: true, amount: true },
      })
      : []

    return {
      festivals,
      entries,
      entryCounts,
      invitations,
      logisticsItems,
      logisticsCounts,
      budgetItems,
      financeLinks,
      financeEntries,
      approvals,
    }
  },

  find: (festivalId: string) => prisma.festival.findUnique({ where: { id: festivalId } }),

  findForUpdate: (tx: Transaction, festivalId: string) =>
    tx.festival.findUnique({
      where: { id: festivalId },
      select: {
        id: true, name: true, year: true, organizer: true, venue: true,
        startDate: true, endDate: true, notes: true, status: true,
      },
    }),

  findFestivalForApproval: (tx: Transaction, festivalId: string) =>
    tx.festival.findUnique({ where: { id: festivalId }, select: { id: true, status: true } }),

  create: (tx: Transaction, input: Prisma.FestivalUncheckedCreateInput) =>
    tx.festival.create({ data: input }),

  update: (tx: Transaction, festivalId: string, input: Prisma.FestivalUncheckedUpdateInput) =>
    tx.festival.update({ where: { id: festivalId }, data: input }),

  festivalExists: (tx: Transaction, festivalId: string) =>
    tx.festival.findUnique({ where: { id: festivalId }, select: { id: true } }),

  categoryForFestival: (tx: Transaction, festivalId: string, categoryId: string) =>
    tx.festivalEntryCategory.findFirst({
      where: { id: categoryId, festivalId },
      select: { id: true, defaultDeadline: true },
    }),

  productionExists: (tx: Transaction, productionId: string) =>
    tx.production.findUnique({ where: { id: productionId }, select: { id: true } }),

  createInvitation: (tx: Transaction, input: Prisma.FestivalInvitationUncheckedCreateInput) =>
    tx.festivalInvitation.create({ data: input }),

  findInvitation: (tx: Transaction, festivalId: string, invitationId: string) =>
    tx.festivalInvitation.findFirst({
      where: { id: invitationId, festivalId },
      select: { id: true, status: true },
    }),

  transitionInvitation: (tx: Transaction, festivalId: string, invitationId: string, data: Prisma.FestivalInvitationUpdateManyMutationInput) =>
    tx.festivalInvitation.updateMany({
      where: { id: invitationId, festivalId, status: 'RECEIVED' },
      data,
    }),

  createCategory: (tx: Transaction, input: Prisma.FestivalEntryCategoryUncheckedCreateInput) =>
    tx.festivalEntryCategory.create({ data: input }),

  findCategory: (tx: Transaction, festivalId: string, categoryId: string) =>
    tx.festivalEntryCategory.findFirst({
      where: { id: categoryId, festivalId },
      select: { id: true, name: true },
    }),

  updateCategory: (tx: Transaction, categoryId: string, input: Prisma.FestivalEntryCategoryUncheckedUpdateInput) =>
    tx.festivalEntryCategory.update({ where: { id: categoryId }, data: input }),

  createEntry: (tx: Transaction, input: Prisma.FestivalEntryUncheckedCreateInput) =>
    tx.festivalEntry.create({ data: input }),

  findEntry: (tx: Transaction, festivalId: string, entryId: string) =>
    tx.festivalEntry.findFirst({
      where: { id: entryId, festivalId },
      select: { id: true, status: true },
    }),

  transitionEntry: (tx: Transaction, festivalId: string, entryId: string, from: FestivalEntryStatus, data: Prisma.FestivalEntryUpdateManyMutationInput) =>
    tx.festivalEntry.updateMany({
      where: { id: entryId, festivalId, status: from },
      data,
    }),

  isCurrentActiveMember: (tx: Transaction, memberId: string) => tx.seasonMembership.findFirst({
    where: { memberId, status: 'ACTIVE', season: { isCurrent: true } },
    select: { memberId: true },
  }),

  createLogisticsItem: (tx: Transaction, input: Prisma.FestivalLogisticsItemUncheckedCreateInput) =>
    tx.festivalLogisticsItem.create({ data: input }),

  findLogisticsItem: (tx: Transaction, festivalId: string, logisticsItemId: string) =>
    tx.festivalLogisticsItem.findFirst({
      where: { id: logisticsItemId, festivalId },
      select: {
        id: true, category: true, title: true, description: true, dueAt: true,
        assignedMemberId: true, status: true,
      },
    }),

  updateLogisticsItem: (
    tx: Transaction,
    festivalId: string,
    logisticsItemId: string,
    data: Prisma.FestivalLogisticsItemUpdateManyMutationInput,
  ) => tx.festivalLogisticsItem.updateMany({
    where: { id: logisticsItemId, festivalId },
    data,
  }),

  transitionLogisticsItem: (
    tx: Transaction,
    festivalId: string,
    logisticsItemId: string,
    from: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED',
    data: Prisma.FestivalLogisticsItemUpdateManyMutationInput,
  ) => tx.festivalLogisticsItem.updateMany({
    where: { id: logisticsItemId, festivalId, status: from },
    data,
  }),

  createBudgetItem: (tx: Transaction, input: Prisma.FestivalBudgetItemUncheckedCreateInput) =>
    tx.festivalBudgetItem.create({ data: input }),

  findBudgetItem: (tx: Transaction, festivalId: string, budgetItemId: string) =>
    tx.festivalBudgetItem.findFirst({
      where: { id: budgetItemId, festivalId },
      select: { id: true, type: true, category: true, plannedAmount: true, notes: true },
    }),

  updateBudgetItem: (tx: Transaction, festivalId: string, budgetItemId: string, input: Prisma.FestivalBudgetItemUncheckedUpdateInput) =>
    tx.festivalBudgetItem.updateMany({ where: { id: budgetItemId, festivalId }, data: input }),

  countFinanceLinksForBudgetItem: (tx: Transaction, budgetItemId: string) =>
    tx.festivalFinanceLink.count({ where: { budgetItemId } }),

  findApprovalByTargetKey: (tx: Transaction, targetKey: string) =>
    tx.festivalApproval.findUnique({ where: { targetKey } }),

  createApproval: (tx: Transaction, input: Prisma.FestivalApprovalUncheckedCreateInput) =>
    tx.festivalApproval.create({ data: input }),

  resubmitRejectedApproval: (
    tx: Transaction,
    approvalId: string,
    input: Prisma.FestivalApprovalUpdateManyMutationInput,
  ) => tx.festivalApproval.updateMany({
    where: { id: approvalId, status: 'REJECTED' },
    data: input,
  }),

  resubmitApprovedApproval: (
    tx: Transaction,
    targetKey: string,
    input: Prisma.FestivalApprovalUpdateManyMutationInput,
  ) => tx.festivalApproval.updateMany({
    where: { targetKey, status: 'APPROVED' },
    data: input,
  }),

  updatePendingApprovalAmount: (tx: Transaction, targetKey: string, requestedAmount: number) =>
    tx.festivalApproval.updateMany({
      where: { targetKey, status: 'PENDING', type: 'BUDGET' },
      data: { requestedAmount },
    }),

  findApprovalById: (tx: Transaction, approvalId: string) =>
    tx.festivalApproval.findUnique({ where: { id: approvalId } }),

  decideApproval: (
    tx: Transaction,
    approvalId: string,
    input: Prisma.FestivalApprovalUpdateManyMutationInput,
  ) => tx.festivalApproval.updateMany({
    where: { id: approvalId, status: 'PENDING' },
    data: input,
  }),

  findFinanceEntry: (tx: Transaction, financeEntryId: string) =>
    tx.financeEntry.findUnique({
      where: { id: financeEntryId },
      select: { id: true, type: true, amount: true, category: true, description: true, occurredAt: true },
    }),

  findFinanceLinkByEntry: (tx: Transaction, financeEntryId: string) =>
    tx.festivalFinanceLink.findUnique({
      where: { financeEntryId },
      select: { id: true },
    }),

  createFinanceLink: (tx: Transaction, input: Prisma.FestivalFinanceLinkUncheckedCreateInput) =>
    tx.festivalFinanceLink.create({ data: input }),

  findFinanceLink: (tx: Transaction, festivalId: string, linkId: string) =>
    tx.festivalFinanceLink.findFirst({
      where: { id: linkId, festivalId },
      select: { id: true, budgetItemId: true, financeEntryId: true },
    }),

  deleteFinanceLink: (tx: Transaction, festivalId: string, linkId: string) =>
    tx.festivalFinanceLink.deleteMany({ where: { id: linkId, festivalId } }),

  planningData: async (festivalId: string) => {
    const [categories, invitations, entries, budgetItems, financeLinks, approvals, logisticsItems, activeMembers] = await Promise.all([
      prisma.festivalEntryCategory.findMany({
        where: { festivalId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
      prisma.festivalInvitation.findMany({
        where: { festivalId },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      prisma.festivalEntry.findMany({
        where: { festivalId },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      prisma.festivalBudgetItem.findMany({
        where: { festivalId },
        orderBy: [{ type: 'asc' }, { category: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
      prisma.festivalFinanceLink.findMany({
        where: { festivalId },
        orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.festivalApproval.findMany({
        where: { festivalId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      prisma.festivalLogisticsItem.findMany({
        where: { festivalId },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      prisma.seasonMembership.findMany({
        where: { status: 'ACTIVE', season: { isCurrent: true } },
        orderBy: [{ member: { fullName: 'asc' } }, { memberId: 'asc' }],
        take: 300,
        select: { memberId: true, member: { select: { fullName: true } } },
      }),
    ])
    const productionIds = [...new Set(entries.flatMap((entry) => entry.productionId ? [entry.productionId] : []))]
    const approvalUserIds = [...new Set(approvals.flatMap((approval) => [
      approval.submittedById,
      ...(approval.decidedById ? [approval.decidedById] : []),
    ]))]
    const logisticsActorIds = [...new Set(logisticsItems.flatMap((item) =>
      item.completedById ? [item.completedById] : [],
    ))]
    const logisticsMemberIds = [...new Set(logisticsItems.flatMap((item) =>
      item.assignedMemberId ? [item.assignedMemberId] : [],
    ))]
    const linkedFinanceEntryIds = [...new Set(financeLinks.map((link) => link.financeEntryId))]
    const [productions, linkedFinanceEntries, recentFinanceEntries, approvalUsers, logisticsActors, logisticsMembers] = await Promise.all([
      productionIds.length
        ? prisma.production.findMany({
        where: { id: { in: productionIds } },
        select: { id: true, title: true },
      })
        : Promise.resolve([]),
      linkedFinanceEntryIds.length
        ? prisma.financeEntry.findMany({
          where: { id: { in: linkedFinanceEntryIds } },
          select: { id: true, type: true, amount: true, category: true, description: true, occurredAt: true },
        })
        : Promise.resolve([]),
      prisma.financeEntry.findMany({
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 200,
        select: { id: true, type: true, amount: true, category: true, description: true, occurredAt: true },
      }),
      approvalUserIds.length
        ? prisma.user.findMany({
          where: { id: { in: approvalUserIds } },
          select: { id: true, name: true },
        })
        : Promise.resolve([]),
      logisticsActorIds.length
        ? prisma.user.findMany({
          where: { id: { in: logisticsActorIds } },
          select: { id: true, name: true },
        })
        : Promise.resolve([]),
      logisticsMemberIds.length
        ? prisma.member.findMany({
          where: { id: { in: logisticsMemberIds } },
          select: { id: true, fullName: true },
        })
        : Promise.resolve([]),
    ])
    const recentLinks = recentFinanceEntries.length
      ? await prisma.festivalFinanceLink.findMany({
        where: { financeEntryId: { in: recentFinanceEntries.map((entry) => entry.id) } },
        select: { financeEntryId: true },
      })
      : []
    const alreadyLinked = new Set(recentLinks.map((link) => link.financeEntryId))
    const unlinkedFinanceEntries = recentFinanceEntries.filter((entry) => !alreadyLinked.has(entry.id)).slice(0, 100)
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
    const productionNames = new Map(productions.map((production) => [production.id, production.title]))
    const financeEntries = new Map(linkedFinanceEntries.map((entry) => [entry.id, entry]))
    const approvalNames = new Map(approvalUsers.map((user) => [user.id, user.name]))
    const logisticsActorNames = new Map(logisticsActors.map((user) => [user.id, user.name]))
    const logisticsMemberNames = new Map(logisticsMembers.map((member) => [member.id, member.fullName]))
    const approvalByTarget = new Map(approvals.map((approval) => [approval.targetKey, {
      ...approval,
      submittedByName: approvalNames.get(approval.submittedById) ?? 'Unknown user',
      decidedByName: approval.decidedById ? approvalNames.get(approval.decidedById) ?? 'Unknown user' : null,
    }]))
    const budgetAmounts = new Map<string, number[]>()
    for (const link of financeLinks) {
      const linked = financeEntries.get(link.financeEntryId)
      if (linked) {
        const amounts = budgetAmounts.get(link.budgetItemId) ?? []
        amounts.push(linked.amount)
        budgetAmounts.set(link.budgetItemId, amounts)
      }
    }
    const productionOptions = await prisma.production.findMany({
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take: 100,
      select: { id: true, title: true },
    })
    return {
      categories,
      invitations,
      entries: entries.map((entry) => ({
        ...entry,
        categoryName: categoryNames.get(entry.categoryId) ?? 'Unknown category',
        productionTitle: entry.productionId ? productionNames.get(entry.productionId) ?? 'Unknown production' : null,
      })),
      budgetItems: budgetItems.map((item) => ({
        ...item,
        actualAmount: sumLinkedFinanceAmounts(budgetAmounts.get(item.id) ?? []),
        approval: approvalByTarget.get(`BUDGET:${item.id}`) ?? null,
        links: financeLinks
          .filter((link) => link.budgetItemId === item.id)
          .map((link) => ({
            ...link,
            financeEntry: financeEntries.get(link.financeEntryId) ?? null,
          })),
      })),
      logisticsItems: logisticsItems.map((item) => ({
        ...item,
        assignedMemberName: item.assignedMemberId
          ? logisticsMemberNames.get(item.assignedMemberId) ?? 'Former member'
          : null,
        completedByName: item.completedById
          ? logisticsActorNames.get(item.completedById) ?? 'Unknown user'
          : null,
      })),
      logisticsAssigneeOptions: activeMembers.map(({ memberId, member }) => ({
        id: memberId,
        fullName: member.fullName,
      })),
      unlinkedFinanceEntries,
      productionOptions,
      planApproval: approvalByTarget.get(`PLAN:${festivalId}`) ?? null,
    }
  },
}
