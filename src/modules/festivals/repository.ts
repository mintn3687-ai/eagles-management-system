import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
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

  planningData: async (festivalId: string) => {
    const [categories, invitations, entries] = await Promise.all([
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
    ])
    const productionIds = [...new Set(entries.flatMap((entry) => entry.productionId ? [entry.productionId] : []))]
    const productions = productionIds.length
      ? await prisma.production.findMany({
        where: { id: { in: productionIds } },
        select: { id: true, title: true },
      })
      : []
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
    const productionNames = new Map(productions.map((production) => [production.id, production.title]))
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
      productionOptions,
    }
  },
}
