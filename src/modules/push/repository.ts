import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const pushRepository = {
  async hasSubscription(userId: string, token: string) {
    return Boolean(await prisma.pushSubscription.findFirst({ where: { userId, token }, select: { id: true } }))
  },

  async saveSubscription(userId: string, token: string) {
    return prisma.pushSubscription.upsert({
      where: { token },
      create: { userId, token },
      update: { userId },
      select: { id: true },
    })
  },

  async removeSubscription(userId: string, token: string) {
    return prisma.pushSubscription.deleteMany({ where: { userId, token } })
  },

  async removeSubscriptionById(id: string) {
    return prisma.pushSubscription.deleteMany({ where: { id } })
  },

  async listEligibleSubscriptions() {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        consentAcceptedAt: { not: null },
        OR: [
          { member: { is: null } },
          { member: { is: { status: { notIn: ['SUSPENDED', 'INACTIVE'] } } } },
        ],
      },
      select: { id: true },
    })
    if (!users.length) return []
    return prisma.pushSubscription.findMany({
      where: { userId: { in: users.map(({ id }) => id) } },
      select: { id: true, userId: true, token: true },
    })
  },

  async listScheduledRehearsals(from: Date, through: Date) {
    return prisma.rehearsal.findMany({
      where: { status: 'SCHEDULED', date: { gte: from, lte: through } },
      select: { id: true, date: true, startTime: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
  },

  async claimDelivery(subscriptionId: string, userId: string, eventKey: string) {
    try {
      await prisma.pushDelivery.create({ data: { subscriptionId, userId, eventKey } })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false
      throw error
    }
  },

  markDeliverySent(subscriptionId: string, eventKey: string) {
    return prisma.pushDelivery.update({
      where: { subscriptionId_eventKey: { subscriptionId, eventKey } },
      data: { sentAt: new Date() },
    })
  },

  removeDelivery(subscriptionId: string, eventKey: string) {
    return prisma.pushDelivery.deleteMany({ where: { subscriptionId, eventKey } })
  },
}
