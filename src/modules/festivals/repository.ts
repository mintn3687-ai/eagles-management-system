import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

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
}
