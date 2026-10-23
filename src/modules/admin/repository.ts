import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const adminRepository = {
  invitableUsers: (where: Prisma.UserWhereInput, skip: number, take: number) => Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
  ]),
  auditCount: (where: Prisma.AuditLogWhereInput) => prisma.auditLog.count({ where }),
  auditPage: (where: Prisma.AuditLogWhereInput, skip: number, take: number) => prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take,
    select: {
      id: true, action: true, entity: true, entityId: true, details: true, createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  }),
  feeHistoryCount: () => prisma.feeSetting.count(),
  feeHistoryPage: (skip: number, take: number) => prisma.feeSetting.findMany({
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    skip,
    take,
    include: { createdBy: { select: { name: true } } },
  }),
  teamCount: () => prisma.member.count({ where: { userId: { not: null } } }),
  teamPage: (skip: number, take: number) => prisma.member.findMany({
    where: { userId: { not: null } },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    skip,
    take,
    select: { id: true, fullName: true, status: true, user: { select: { id: true, email: true, role: true, isActive: true } } },
  }),
  memberList: (where: Prisma.MemberWhereInput, orderBy: Prisma.MemberOrderByWithRelationInput[], skip: number, take: number) =>
    Promise.all([
      prisma.member.findMany({
        where, orderBy, skip, take,
        select: { id: true, fullName: true, phone: true, email: true, status: true, joinedAt: true },
      }),
      prisma.member.count({ where }),
    ]),
  paymentMemberOptions: (skip: number, take: number) => Promise.all([
    prisma.member.count(),
    prisma.member.findMany({
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip,
      take,
      select: { id: true, fullName: true },
    }),
  ]),
  paymentLedger: (where: Prisma.PaymentWhereInput, skip: number, take: number) => Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      skip,
      take,
      include: { member: { select: { fullName: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, type: 'REGISTRATION', status: 'SUCCESS' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...where, type: 'SUBSCRIPTION', status: 'SUCCESS' }, _sum: { amount: true } }),
  ]),
  paymentReceipt: (id: string) => prisma.payment.findUnique({
    where: { id },
    include: { member: { select: { fullName: true, email: true } } },
  }),
  analyticsMember: (id: string) => prisma.member.findUnique({
    where: { id },
    select: { id: true, fullName: true, joinedAt: true },
  }),
  rehearsal: (id: string) => prisma.rehearsal.findUnique({
    where: { id },
    select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true, checkInCode: true, createdBy: { select: { name: true } } },
  }),
  attendanceSheetMemberCount: (rehearsalId: string) => prisma.member.count({
    where: {
      OR: [
        { status: 'ACTIVE' },
        { rehearsals: { some: { rehearsalId } } },
      ],
    },
  }),
  attendanceSheetMembers: (rehearsalId: string, skip: number, take: number) => prisma.member.findMany({
    where: {
      OR: [
        { status: 'ACTIVE' },
        { rehearsals: { some: { rehearsalId } } },
      ],
    },
    select: {
      id: true, fullName: true, phone: true, joinedAt: true, status: true,
      rehearsals: { where: { rehearsalId }, select: { id: true, status: true, markedBy: true, reason: true, reviewStatus: true } },
    },
    orderBy: { fullName: 'asc' },
    skip,
    take,
  }),
  memberSubscriptionPayment: (memberId: string) => prisma.payment.findFirst({
    where: { memberId, type: 'SUBSCRIPTION', status: 'SUCCESS' },
    orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    select: { periodStart: true, periodEnd: true },
  }),
}

export type AdminAuditFilters = Prisma.AuditLogWhereInput
