import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma, type MemberStatus, type UserRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { lockRow } from '@/lib/row-lock'

type Transaction = Prisma.TransactionClient

function insertMemberStatusHistory(tx: Transaction, memberId: string, status: MemberStatus, effectiveAt: Date) {
  return tx.$executeRaw`
    INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
    VALUES (${randomUUID()}, ${memberId}, ${status}::"MemberStatus", ${effectiveAt})
  `
}

export const memberDetailsRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
  lockMember: (tx: Transaction, memberId: string) => lockRow(tx, 'Member', memberId),
  lockUser: (tx: Transaction, userId: string) => lockRow(tx, 'User', userId),
  hasEmailConflict: async (tx: Transaction, email: string, memberId?: string, userId?: string | null) => {
    const [member, user] = await Promise.all([
      tx.member.findUnique({ where: { email }, select: { id: true } }),
      tx.user.findUnique({ where: { email }, select: { id: true } }),
    ])
    return Boolean((member && member.id !== memberId) || (user && user.id !== userId))
  },
  createUser: (tx: Transaction, email: string, name: string) =>
    tx.user.create({ data: { email, name, role: 'MEMBER' } }),
  createMember: (tx: Transaction, data: Prisma.MemberUncheckedCreateInput) => tx.member.create({ data }),
  createInvite: (tx: Transaction, data: Prisma.InviteUncheckedCreateInput) => tx.invite.create({ data }),
  insertStatusHistory: insertMemberStatusHistory,
  recordStatusChange: (
    tx: Transaction,
    memberId: string,
    from: MemberStatus,
    to: MemberStatus,
    effectiveAt: Date,
  ) => from === to ? Promise.resolve() : insertMemberStatusHistory(tx, memberId, to, effectiveAt),
  findMemberForEdit: (tx: Transaction, memberId: string) => tx.member.findUnique({ where: { id: memberId } }),
  updateMember: (tx: Transaction, memberId: string, data: Prisma.MemberUncheckedUpdateInput) =>
    tx.member.update({ where: { id: memberId }, data }),
  updateUser: (tx: Transaction, userId: string, data: Prisma.UserUncheckedUpdateInput) =>
    tx.user.update({ where: { id: userId }, data }),
  invalidateUnusedInvites: (tx: Transaction, userId: string, now: Date) =>
    tx.invite.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
  findMemberForStatus: (tx: Transaction, memberId: string) => tx.member.findUnique({ where: { id: memberId } }),
  memberUserRole: (tx: Transaction, userId: string) => tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
  findMemberLogin: (tx: Transaction, memberId: string) =>
    tx.member.findUnique({ where: { id: memberId }, select: { userId: true } }),
  userRole: (tx: Transaction, userId: string) => tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
  updateRole: (tx: Transaction, userId: string, role: UserRole) =>
    tx.user.update({ where: { id: userId }, data: { role } }),
  inviteTarget: (memberId: string) => prisma.member.findUnique({
    where: { id: memberId },
    select: { userId: true, fullName: true, phone: true },
  }),
  rosterPdfPage: (cursor?: string, take = 500) => prisma.member.findMany({
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      studentRegNo: true,
      status: true,
      joinedAt: true,
    },
  }),
  findById: (memberId: string) => prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      studentRegNo: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      notes: true,
      status: true,
      joinedAt: true,
      userId: true,
      user: { select: { role: true } },
      rehearsals: {
        where: { rehearsal: { status: 'CLOSED' } },
        orderBy: [{ rehearsal: { date: 'desc' } }, { id: 'desc' }],
        take: 10,
        select: {
          id: true,
          status: true,
          reviewStatus: true,
          rehearsal: { select: { title: true, date: true } },
        },
      },
      payments: {
        orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          method: true,
          paidAt: true,
          createdAt: true,
        },
      },
      seasonMemberships: {
        where: { season: { isCurrent: true } },
        take: 1,
        select: {
          status: true,
          roleInSeason: true,
          feesOwed: true,
          feesPaid: true,
          season: { select: { name: true } },
        },
      },
    },
  }),
}
