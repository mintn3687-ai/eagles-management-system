import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const byId = (take: number, cursor?: string) => ({
  orderBy: { id: 'asc' as const },
  take,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
})

export const adminExportRepository = {
  members: (cursor?: string, take = 500) => prisma.member.findMany({
    ...byId(take, cursor),
    include: { user: { select: { email: true, role: true, isActive: true } } },
  }),
  rehearsals: (cursor?: string, take = 500) => prisma.rehearsal.findMany(byId(take, cursor)),
  attendance: (cursor?: string, take = 500) => prisma.attendance.findMany({
    ...byId(take, cursor),
    include: { member: { select: { fullName: true } }, rehearsal: { select: { title: true, date: true } } },
  }),
  payments: (cursor?: string, take = 500) => prisma.payment.findMany({
    ...byId(take, cursor),
    include: { member: { select: { fullName: true } } },
  }),
  audit: (cursor?: string, take = 500) => prisma.auditLog.findMany({
    ...byId(take, cursor),
    include: { actor: { select: { name: true, email: true } } },
  }),
  memberCsvPage: (
    where: Prisma.MemberWhereInput,
    orderBy: Prisma.MemberOrderByWithRelationInput[],
    cursor: string | undefined,
    take: number,
  ) => prisma.member.findMany({
    where,
    orderBy,
    select: { id: true, fullName: true, phone: true, email: true, studentRegNo: true },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }),
  paymentCsvPage: (where: Prisma.PaymentWhereInput, skip: number, take: number) =>
    prisma.payment.findMany({
      where,
      orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      skip,
      take,
      select: {
        id: true, type: true, status: true, method: true, source: true, amount: true,
        paidAt: true, createdAt: true, reference: true, mpesaReceipt: true,
        member: { select: { fullName: true } },
        paymentEvent: { select: { title: true } },
      },
    }),
}
