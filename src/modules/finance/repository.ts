import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const financeRepository = {
  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
  memberForPayment: (tx: Transaction, memberId: string) => tx.member.findUnique({
    where: { id: memberId },
    select: { id: true, status: true },
  }),
  latestSuccessfulSubscription: (tx: Transaction, memberId: string) => tx.payment.findFirst({
    where: { memberId, type: 'SUBSCRIPTION', status: 'SUCCESS' },
    orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    select: { periodEnd: true, paidAt: true },
  }),
  hasPendingMemberPayment: (tx: Transaction, memberId: string, type: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING') =>
    tx.payment.findFirst({ where: { memberId, type, status: 'PENDING' }, select: { id: true } }),
  findPaymentByReference: (
    tx: Transaction,
    memberId: string,
    type: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING',
    reference: string,
  ) => tx.payment.findFirst({
    where: { memberId, type, reference: { equals: reference, mode: 'insensitive' } },
    select: { id: true, status: true },
  }),
  effectiveFee: (tx: Transaction, type: 'REGISTRATION' | 'SUBSCRIPTION' | 'RETREAT_BONDING', at: Date) => tx.feeSetting.findFirst({
    where: { type, effectiveFrom: { lte: at } },
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
  }),
  billingPeriodSetting: (tx: Transaction) => tx.setting.findUnique({
    where: { key: 'subscriptionBillingPeriod' },
    select: { value: true },
  }),
  createPayment: (tx: Transaction, data: Prisma.PaymentUncheckedCreateInput) => tx.payment.create({ data }),
  activateMember: (tx: Transaction, memberId: string, joinedAt?: Date) => tx.member.update({
    where: { id: memberId },
    data: { status: 'ACTIVE', ...(joinedAt ? { joinedAt } : {}) },
  }),
  createFeeSetting: (tx: Transaction, data: Prisma.FeeSettingUncheckedCreateInput) => tx.feeSetting.create({ data }),
  findPaymentRequest: (tx: Transaction, idempotencyKey: string) => tx.payment.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  }),
  createPaymentRequest: (tx: Transaction, data: Prisma.PaymentUncheckedCreateInput) => tx.payment.create({ data }),
  paymentForReview: (tx: Transaction, id: string) => tx.payment.findUnique({
    where: { id },
    select: { id: true, memberId: true, type: true, amount: true, method: true, reference: true, status: true, source: true },
  }),
  updatePaymentReview: (tx: Transaction, id: string, data: Prisma.PaymentUncheckedUpdateInput) =>
    tx.payment.update({ where: { id }, data }),
  memberPaymentHistory: (memberId: string) => prisma.payment.findMany({
    where: { memberId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: {
      id: true, type: true, amount: true, status: true, method: true, source: true,
      reference: true, resultDesc: true, createdAt: true, paidAt: true, periodStart: true, periodEnd: true,
    },
  }),
  saveSubscriptionBillingPeriod: (tx: Transaction, period: 'MONTHLY' | 'TERM' | 'YEAR') => tx.setting.upsert({
    where: { key: 'subscriptionBillingPeriod' },
    update: { value: period },
    create: { key: 'subscriptionBillingPeriod', value: period },
  }),
}

export const seasonPaymentsRepository = {
  findSeasonAt: (tx: Transaction, date: Date) => tx.season.findFirst({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true, startDate: true, endDate: true },
  }),

  assignPaymentToSeason: (tx: Transaction, paymentId: string, seasonId: string) =>
    tx.payment.update({ where: { id: paymentId }, data: { seasonId } }),

  upsertMembershipPayment: (tx: Transaction, input: {
    seasonId: string
    memberId: string
    amount: number
  }) => tx.seasonMembership.upsert({
    where: { seasonId_memberId: { seasonId: input.seasonId, memberId: input.memberId } },
    update: { feesPaid: { increment: input.amount }, status: 'ACTIVE' },
    create: {
      seasonId: input.seasonId,
      memberId: input.memberId,
      status: 'ACTIVE',
      feesOwed: 0,
      feesPaid: input.amount,
    },
  }),
}
