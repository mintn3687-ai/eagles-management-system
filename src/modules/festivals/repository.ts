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

  find: (festivalId: string) => prisma.festival.findUnique({ where: { id: festivalId } }),

  findForUpdate: (tx: Transaction, festivalId: string) =>
    tx.festival.findUnique({
      where: { id: festivalId },
      select: { id: true, name: true, year: true, status: true },
    }),

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

  createBudgetItem: (tx: Transaction, input: Prisma.FestivalBudgetItemUncheckedCreateInput) =>
    tx.festivalBudgetItem.create({ data: input }),

  findBudgetItem: (tx: Transaction, festivalId: string, budgetItemId: string) =>
    tx.festivalBudgetItem.findFirst({
      where: { id: budgetItemId, festivalId },
      select: { id: true, type: true, category: true, plannedAmount: true },
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
    const [categories, invitations, entries, budgetItems, financeLinks] = await Promise.all([
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
    ])
    const productionIds = [...new Set(entries.flatMap((entry) => entry.productionId ? [entry.productionId] : []))]
    const linkedFinanceEntryIds = [...new Set(financeLinks.map((link) => link.financeEntryId))]
    const [productions, linkedFinanceEntries, recentFinanceEntries] = await Promise.all([
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
        links: financeLinks
          .filter((link) => link.budgetItemId === item.id)
          .map((link) => ({
            ...link,
            financeEntry: financeEntries.get(link.financeEntryId) ?? null,
          })),
      })),
      unlinkedFinanceEntries,
      productionOptions,
    }
  },
}
