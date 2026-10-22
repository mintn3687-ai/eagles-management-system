import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Transaction = Prisma.TransactionClient

export const meetingsRepository = {
  activeCurrentMembers: (tx: Transaction) => tx.seasonMembership.findMany({
    where: { season: { isCurrent: true }, status: 'ACTIVE' },
    orderBy: { memberId: 'asc' },
    select: { memberId: true, member: { select: { fullName: true } } },
  }),

  createMeeting: (tx: Transaction, input: {
    title: string
    startsAt: Date
    venue: string
    quorumPercent: number
    quorumEligibleCount: number
    createdById: string
  }) => tx.meeting.create({ data: input, select: { id: true, title: true } }),

  createAttendanceSnapshot: (tx: Transaction, meetingId: string, memberIds: string[]) =>
    tx.meetingAttendance.createMany({ data: memberIds.map((memberId) => ({ meetingId, memberId })) }),

  listMeetings: () => prisma.meeting.findMany({
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: {
      id: true, title: true, startsAt: true, venue: true, status: true,
      minutesStatus: true, quorumPercent: true, quorumEligibleCount: true,
      _count: { select: { attendances: true, motions: true, actionItems: true } },
      attendances: { where: { attended: true }, select: { id: true } },
    },
  }),

  findMeeting: (tx: Transaction, meetingId: string) => tx.meeting.findUnique({
    where: { id: meetingId },
    include: {
      agendaItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      attendances: { orderBy: [{ member: { fullName: 'asc' } }, { memberId: 'asc' }], include: { member: { select: { fullName: true } } } },
      motions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      actionItems: { orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], include: { owner: { select: { id: true, fullName: true } } } },
    },
  }),

  updateStatus: (tx: Transaction, meetingId: string, status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') =>
    tx.meeting.update({ where: { id: meetingId }, data: { status } }),

  createAgendaItem: async (tx: Transaction, meetingId: string, input: { title: string; description: string }) => {
    const previous = await tx.meetingAgendaItem.aggregate({ where: { meetingId }, _max: { sortOrder: true } })
    return tx.meetingAgendaItem.create({
      data: {
        meetingId,
        title: input.title,
        description: input.description || null,
        sortOrder: (previous._max.sortOrder ?? -1) + 1,
      },
    })
  },

  setAttendance: (tx: Transaction, meetingId: string, memberId: string, attended: boolean) =>
    tx.meetingAttendance.updateMany({ where: { meetingId, memberId }, data: { attended } }),

  saveMinutes: (tx: Transaction, meetingId: string, minutes: string) =>
    tx.meeting.update({ where: { id: meetingId }, data: { minutes, minutesStatus: 'DRAFT', minutesApprovedAt: null, minutesApprovedById: null } }),

  approveMinutes: (tx: Transaction, meetingId: string, actorId: string, at: Date) =>
    tx.meeting.update({ where: { id: meetingId }, data: { minutesStatus: 'APPROVED', minutesApprovedAt: at, minutesApprovedById: actorId } }),

  createMotion: (tx: Transaction, meetingId: string, input: { title: string; description: string }) =>
    tx.motion.create({ data: { meetingId, title: input.title, description: input.description || null } }),

  findMotion: (tx: Transaction, meetingId: string, motionId: string) =>
    tx.motion.findFirst({ where: { id: motionId, meetingId } }),

  decideMotion: (tx: Transaction, motionId: string, input: {
    status: 'APPROVED' | 'REJECTED' | 'DEFERRED'
    decisionNote: string
    decidedById: string
    decidedAt: Date
  }) => tx.motion.update({ where: { id: motionId }, data: { ...input, decisionNote: input.decisionNote || null } }),

  hasMeetingMember: (tx: Transaction, meetingId: string, memberId: string) =>
    tx.meetingAttendance.findUnique({ where: { meetingId_memberId: { meetingId, memberId } }, select: { id: true } }),

  createActionItem: (tx: Transaction, input: {
    meetingId: string
    title: string
    description: string
    ownerMemberId: string
    dueAt: Date | null
    createdById: string
  }) => tx.meetingActionItem.create({ data: { ...input, description: input.description || null } }),

  findActionItem: (tx: Transaction, meetingId: string, actionItemId: string) =>
    tx.meetingActionItem.findFirst({ where: { id: actionItemId, meetingId } }),

  updateActionItemStatus: (tx: Transaction, actionItemId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
    tx.meetingActionItem.update({ where: { id: actionItemId }, data: { status } }),

  memberGovernance: (memberId: string) => prisma.$transaction([
    prisma.meeting.findMany({
      where: { minutesStatus: 'APPROVED' },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true, title: true, startsAt: true, venue: true, minutes: true,
        agendaItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { title: true } },
        motions: { where: { status: { not: 'PENDING' } }, orderBy: [{ createdAt: 'asc' }], select: { title: true, status: true, decisionNote: true } },
      },
    }),
    prisma.meetingActionItem.findMany({
      where: { ownerMemberId: memberId },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true, title: true, description: true, dueAt: true, status: true,
        meeting: { select: { id: true, title: true, startsAt: true } },
      },
    }),
  ]),

  transaction: <T>(work: (tx: Transaction) => Promise<T>) => prisma.$transaction(work),
}
