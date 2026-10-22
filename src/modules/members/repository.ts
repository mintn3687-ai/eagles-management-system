import 'server-only'
import { prisma } from '@/lib/db'

export const memberDetailsRepository = {
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
