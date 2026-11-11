import { lockRow } from '../row-lock'
import 'server-only'
import { randomInt } from 'node:crypto'
import { Prisma, type RehearsalStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db'
import { requireRole, requireUser, isRestricted, AccessError } from '../permissions'
import { userIdSchema } from '../validation'
import { rehearsalCreateSchema, rehearsalEditSchema, checkInCodeSchema, attendReasonSchema, weeklyGenerateSchema } from '../validation/rehearsals'
import { nairobiDateKey, parseNairobiDate } from '../dates'
import { consumeRateLimit } from '../rate-limit'
import { attendanceWindowClosed, evaluateCheckInAttempt } from '../attendance-rules'

export class RehearsalError extends Error {}
export function rehearsalErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0].message
  if (error instanceof RehearsalError || error instanceof AccessError) return error.message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'That rehearsal ID is already in use.'
  return 'Could not save the change. Please try again.'
}

export type RehearsalInput = z.infer<typeof rehearsalCreateSchema>
export type RehearsalEditInput = z.infer<typeof rehearsalEditSchema>
export type WeeklyGenInput = z.infer<typeof weeklyGenerateSchema>

function rehearsalCutoff(date: Date, endTime: string) {
  return parseNairobiDate(nairobiDateKey(date), endTime)
}

async function createPendingAttendance(tx: Prisma.TransactionClient, rehearsal: {
  id: string
  date: Date
  startTime: string
}) {
  const members = await tx.member.findMany({
    where: {
      status: 'ACTIVE',
      joinedAt: { lte: rehearsalCutoff(rehearsal.date, rehearsal.startTime) },
    },
    select: { id: true },
  })
  if (!members.length) return 0
  const result = await tx.attendance.createMany({
    data: members.map(({ id }) => ({
      rehearsalId: rehearsal.id,
      memberId: id,
      status: 'NO_RESPONSE',
      markedBy: 'SYSTEM',
      reviewStatus: 'NONE',
    })),
    skipDuplicates: true,
  })
  return result.count
}

async function closeAndMarkAbsent(
  tx: Prisma.TransactionClient,
  rehearsal: { id: string },
  actorId: string,
  closedAt: Date,
  by: 'SYSTEM' | 'COMMITTEE',
) {
  await tx.rehearsal.update({
    where: { id: rehearsal.id },
    data: { status: 'CLOSED', checkInCode: null },
  })
  const unanswered = await tx.attendance.findMany({
    where: { rehearsalId: rehearsal.id, status: 'NO_RESPONSE' },
    select: { id: true, memberId: true },
  })
  if (unanswered.length) {
    await tx.attendance.updateMany({
      where: { rehearsalId: rehearsal.id, status: 'NO_RESPONSE' },
      data: {
        status: 'ABSENT',
        markedBy: 'SYSTEM',
        markedAt: closedAt,
        checkedInAt: null,
        reviewStatus: 'NONE',
      },
    })
    await tx.auditLog.createMany({
      data: unanswered.map(({ id, memberId }) => ({
        actorId,
        action: 'ATTENDANCE_AUTO_MARKED_ABSENT',
        entity: 'Attendance',
        entityId: id,
        details: { rehearsalId: rehearsal.id, memberId, by: 'SYSTEM', reason: 'No attendance response before the rehearsal cutoff.' },
      })),
    })
  }
  await tx.auditLog.create({
    data: {
      actorId,
      action: 'SESSION_CLOSED',
      entity: 'Rehearsal',
      entityId: rehearsal.id,
      details: { by, markedAbsent: unanswered.length },
    },
  })
  return unanswered.length
}

export async function createRehearsal(input: unknown): Promise<{ rehearsalId: string }> {
  const actor = await requireRole('COMMITTEE')
  const data = rehearsalCreateSchema.parse(input)
  const date = parseNairobiDate(data.date)
  return prisma.$transaction(async (tx) => {
    const rehearsal = await tx.rehearsal.create({
      data: {
        title: data.title,
        date,
        startTime: data.startTime,
        endTime: data.endTime,
        venue: data.venue,
        status: 'SCHEDULED',
        createdById: actor.id,
      },
    })
    const pendingRows = await createPendingAttendance(tx, rehearsal)
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'REHEARSAL_CREATED',
        entity: 'Rehearsal',
        entityId: rehearsal.id,
        details: { date: nairobiDateKey(date), pendingRows },
      },
    })
    return { rehearsalId: rehearsal.id }
  })
}

export async function editRehearsal(id: unknown, input: unknown): Promise<{ rehearsalId: string }> {
  const actor = await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(id)
  const data = rehearsalCreateSchema.parse(input)
  const date = parseNairobiDate(data.date)
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', rehearsalId)
    const existing = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
    if (!existing) throw new RehearsalError('Rehearsal not found.')
    if (existing.status !== 'SCHEDULED') throw new RehearsalError('Only scheduled rehearsals can be edited.')
    const rehearsal = await tx.rehearsal.update({
      where: { id: rehearsalId },
      data: { title: data.title, date, startTime: data.startTime, endTime: data.endTime, venue: data.venue },
    })
    await tx.attendance.deleteMany({
      where: {
        rehearsalId,
        status: 'NO_RESPONSE',
        markedBy: 'SYSTEM',
        reviewStatus: 'NONE',
        member: { OR: [
          { status: { not: 'ACTIVE' } },
          { joinedAt: { gt: rehearsalCutoff(date, data.startTime) } },
        ] },
      },
    })
    await createPendingAttendance(tx, rehearsal)
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'REHEARSAL_EDITED',
        entity: 'Rehearsal',
        entityId: rehearsalId,
        details: { title: data.title, date: nairobiDateKey(date) },
      },
    })
    return { rehearsalId: rehearsal.id }
  })
}

export async function cancelRehearsal(id: unknown, reason: unknown): Promise<void> {
  const actor = await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(id)
  const reasonSchema = z.string().trim().min(1, 'Enter a reason for cancelling.').max(500)
  const cancelReason = reasonSchema.parse(reason)
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', rehearsalId)
    const rehearsal = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
    if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
    if (rehearsal.status === 'CANCELLED') throw new RehearsalError('This rehearsal is already cancelled.')
    await tx.rehearsal.update({ where: { id: rehearsalId }, data: { status: 'CANCELLED', checkInCode: null } })
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'REHEARSAL_CANCELLED', entity: 'Rehearsal', entityId: rehearsalId,
      details: { reason: cancelReason },
    } })
  })
}

export async function openSession(rehearsalIdInput: unknown): Promise<{ checkInCode: string }> {
  const actor = await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  const checkInCode = randomInt(0, 10000).toString().padStart(4, '0')
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', rehearsalId)
    const rehearsal = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
    if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
    if (rehearsal.status !== 'SCHEDULED') throw new RehearsalError('Only scheduled rehearsals can be opened.')
    if (attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('The attendance window is closed. This rehearsal has reached its scheduled end time.')
    }
    await tx.rehearsal.update({ where: { id: rehearsalId }, data: { status: 'OPEN', checkInCode } })
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'SESSION_OPENED', entity: 'Rehearsal', entityId: rehearsalId,
      details: {},
    } })
  })
  return { checkInCode }
}

export async function closeSession(rehearsalIdInput: unknown): Promise<{ markedAbsent: number }> {
  const actor = await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  let markedAbsent = 0
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', rehearsalId)
    const rehearsal = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
    if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
    if (rehearsal.status !== 'OPEN') throw new RehearsalError('Only open sessions can be closed.')
    await createPendingAttendance(tx, rehearsal)
    markedAbsent = await closeAndMarkAbsent(tx, rehearsal, actor.id, new Date(), 'COMMITTEE')
  })
  return { markedAbsent }
}

export async function finalizeDueRehearsals(now = new Date()): Promise<{ closedRehearsals: number; markedAbsent: number }> {
  const candidates = await prisma.rehearsal.findMany({
    where: {
      status: { in: ['SCHEDULED', 'OPEN'] },
      date: { lte: parseNairobiDate(nairobiDateKey(now)) },
    },
    select: { id: true, date: true, endTime: true },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    take: 200,
  })
  const due = candidates.filter(({ date, endTime }) => attendanceWindowClosed(rehearsalCutoff(date, endTime), now))
  let closedRehearsals = 0
  let markedAbsent = 0
  for (const candidate of due) {
    const result = await prisma.$transaction(async (tx) => {
      await lockRow(tx, 'Rehearsal', candidate.id)
      const rehearsal = await tx.rehearsal.findUnique({ where: { id: candidate.id } })
      if (!rehearsal || (rehearsal.status !== 'SCHEDULED' && rehearsal.status !== 'OPEN')) return null
      if (!attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime), now)) return null
      await createPendingAttendance(tx, rehearsal)
      const count = await closeAndMarkAbsent(tx, rehearsal, rehearsal.createdById, now, 'SYSTEM')
      return count
    })
    if (result !== null) {
      closedRehearsals += 1
      markedAbsent += result
    }
  }
  return { closedRehearsals, markedAbsent }
}

export async function setManualAttendance(rehearsalIdInput: unknown, memberIdInput: unknown, status: unknown, noteInput: unknown = undefined): Promise<void> {
  const actor = await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  const memberId = userIdSchema.parse(memberIdInput)
  const statusSchema = z.enum(['PRESENT', 'ABSENT'])
  const newStatus: 'PRESENT' | 'ABSENT' = statusSchema.parse(status)
  const note = z.string().trim().max(1000).optional().parse(noteInput ?? undefined)
  await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', rehearsalId)
    const rehearsal = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
    if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
    if (rehearsal.status === 'CANCELLED') throw new RehearsalError('Cannot mark attendance for a cancelled rehearsal.')
    if (rehearsal.status === 'CLOSED' || attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('Attendance is closed. No one can be marked present after the scheduled end time.')
    }
    await lockRow(tx, 'Member', memberId)
    const member = await tx.member.findUnique({ where: { id: memberId } })
    if (!member) throw new RehearsalError('Member not found.')
    if (member.status !== 'ACTIVE') throw new RehearsalError('Only active members can have attendance marked.')
    const existing = await tx.attendance.findUnique({
      where: { rehearsalId_memberId: { rehearsalId, memberId } },
      select: { id: true, status: true, checkedInAt: true },
    })
    if (attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('Attendance is closed. No one can be marked present after the scheduled end time.')
    }
    if (existing?.status === 'NO_RESPONSE' && newStatus === 'PRESENT' && !note) throw new RehearsalError('A note is required when changing NO_RESPONSE to PRESENT.')
    const review = { reviewStatus: newStatus === 'PRESENT' ? 'NONE' as const : 'PENDING' as const, reviewNote: note || null, reviewedById: newStatus === 'PRESENT' && note ? actor.id : null, reviewedAt: newStatus === 'PRESENT' && note ? new Date() : null }
    const markedAt = new Date()
    const checkedInAt = newStatus === 'PRESENT'
      ? existing?.status === 'PRESENT' ? existing.checkedInAt : markedAt
      : null
    let attendanceId: string
    if (existing) {
      attendanceId = existing.id
      await tx.attendance.update({
        where: { id: existing.id },
        data: { status: newStatus, markedBy: 'COMMITTEE', markedAt, checkedInAt, reason: null, ...review },
      })
    } else {
      const created = await tx.attendance.create({ data: { rehearsalId, memberId, status: newStatus, markedBy: 'COMMITTEE', markedAt, checkedInAt, ...review } })
      attendanceId = created.id
    }
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'ATTENDANCE_MARKED', entity: 'Attendance', entityId: attendanceId,
      details: { rehearsalId, memberId, previousStatus: existing?.status ?? null, status: newStatus, note: note ?? null, by: 'COMMITTEE' },
    } })
  })
}

export async function previewWeekly(options: unknown): Promise<{ weekday: string; time: string; dates: string[] }> {
  await requireRole('COMMITTEE')
  const data = weeklyGenerateSchema.parse(options)
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const targetDay = weekdayNames.indexOf(data.weekday)
  const dates: string[] = []
  for (let d = parseNairobiDate(data.startDate); d <= parseNairobiDate(data.endDate); d.setUTCDate(d.getUTCDate() + 1)) {
    if (new Date(nairobiDateKey(d) + 'T12:00:00Z').getUTCDay() === targetDay) {
      dates.push(nairobiDateKey(d))
    }
  }
  return { weekday: data.weekday, time: `${data.startTime}–${data.endTime}`, dates }
}

export async function generateWeekly(options: unknown, venue: unknown): Promise<{ created: string[] }> {
  const actor = await requireRole('COMMITTEE')
  const data = weeklyGenerateSchema.parse(options)
  const venueSchema = z.string().trim().min(2, 'Enter a venue.').max(200)
  const venueStr = venueSchema.parse(venue)
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const targetDay = weekdayNames.indexOf(data.weekday)
  const dates: Date[] = []
  for (let d = parseNairobiDate(data.startDate); d <= parseNairobiDate(data.endDate); d.setUTCDate(d.getUTCDate() + 1)) {
    if (new Date(nairobiDateKey(d) + 'T12:00:00Z').getUTCDay() === targetDay) dates.push(new Date(d))
  }
  if (dates.length === 0) throw new RehearsalError('No matching weekdays found in the selected range.')
  const created: string[] = []
  const title = `Weekly rehearsal — ${data.weekday}`
  await prisma.$transaction(async (tx) => {
    for (const date of dates) {
      const rehearsal = await tx.rehearsal.create({
        data: {
          title, date, startTime: data.startTime, endTime: data.endTime,
          venue: venueStr, status: 'SCHEDULED', createdById: actor.id,
        },
      })
      await createPendingAttendance(tx, rehearsal)
      created.push(rehearsal.id)
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'REHEARSALS_GENERATED_WEEKLY',
        entity: 'Rehearsal',
        entityId: 'batch',
        details: { count: created.length, weekday: data.weekday, venue: venueStr },
      },
    })
  })
  return { created }
}

export async function getMemberDashboard() {
  const user = await requireUser()
  const member = user.member
  if (!member) return { today: null, next: null, recent: [] }
  const todayKey = nairobiDateKey()
  const upcoming = await prisma.rehearsal.findMany({
    where: {
      status: { not: 'CANCELLED' },
      date: { gte: parseNairobiDate(todayKey) },
    },
    orderBy: { date: 'asc' },
    take: 10,
  })
  const today = upcoming.find((r) => nairobiDateKey(r.date) === todayKey) ?? null
  const next = upcoming.find((r) => nairobiDateKey(r.date) !== todayKey) ?? null
  const recent = await prisma.attendance.findMany({
    where: { memberId: member.id },
    select: {
      id: true, status: true, markedBy: true, markedAt: true, reviewStatus: true,
      rehearsal: { select: { id: true, title: true, date: true, startTime: true, endTime: true, status: true } },
    },
    orderBy: { rehearsal: { date: 'desc' } },
    take: 5,
  })
  return { today, next, recent }
}

async function lockAttendanceContext(tx: Prisma.TransactionClient, rehearsalId: string, memberId: string) {
  await lockRow(tx, 'Rehearsal', rehearsalId)
  await lockRow(tx, 'Member', memberId)
  const rehearsal = await tx.rehearsal.findUnique({ where: { id: rehearsalId } })
  const member = await tx.member.findUnique({ where: { id: memberId } })
  if (!member || member.status !== 'ACTIVE') throw new RehearsalError('Only ACTIVE members can mark attendance.')
  if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
  if (rehearsal.status === 'CANCELLED') throw new RehearsalError('Cancelled rehearsals cannot be marked.')
  return rehearsal
}

export async function markSelfPresent(rehearsalIdInput: unknown, code: unknown) {
  const user = await requireUser()
  if (!user.member || isRestricted(user) || !user.consentAcceptedAt) throw new AccessError(403, 'RESTRICTED')
  const memberId = user.member.id
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  const checkInCode = checkInCodeSchema.parse(code)
  const rate = await consumeRateLimit('check-in', `${memberId}:${rehearsalId}`, 10, 15 * 60_000)
  if (!rate.allowed) throw new RehearsalError('Too many check-in attempts. Please wait and try again.')
  const error = await prisma.$transaction(async (tx) => {
    const rehearsal = await lockAttendanceContext(tx, rehearsalId, memberId)
    if (attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('The attendance window is closed. Check-in ended at the scheduled rehearsal end time.')
    }
    if (rehearsal.status !== 'OPEN') throw new RehearsalError('This session is not open for check-in.')
    const where = { rehearsalId_memberId: { rehearsalId, memberId } }
    const existing = await tx.attendance.findUnique({ where })
    const attempt = evaluateCheckInAttempt({
      submittedCode: checkInCode,
      correctCode: rehearsal.checkInCode,
      wrongCodeTries: existing?.wrongCodeTries ?? 0,
      status: existing?.status ?? null,
    })
    if (attempt === 'ALREADY_PRESENT') throw new RehearsalError('You are already marked present.')
    if (attempt === 'ATTEMPTS_EXHAUSTED') return 'You have used all 5 check-in attempts. Ask the committee for help.'
    if (attempt === 'WRONG_CODE') {
      await tx.attendance.upsert({ where,
        create: { rehearsalId, memberId, status: 'NO_RESPONSE', wrongCodeTries: 1 },
        update: { wrongCodeTries: { increment: 1 } },
      })
      // Return instead of throwing: failed attempts must commit.
      return (existing?.wrongCodeTries ?? 0) + 1 === 5 ? 'Wrong code. You have used all 5 attempts.' : 'Wrong code. Check the projected number and try again.'
    }
    if (attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('The attendance window is closed. Check-in ended at the scheduled rehearsal end time.')
    }
    const checkedInAt = new Date()
    const data = { status: 'PRESENT' as const, markedBy: 'SELF' as const, markedAt: checkedInAt, checkedInAt, reason: null, reviewStatus: 'NONE' as const, reviewNote: null, reviewedById: null, reviewedAt: null }
    const saved = await tx.attendance.upsert({ where, create: { rehearsalId, memberId, ...data }, update: data })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ATTENDANCE_MARKED',
        entity: 'Attendance',
        entityId: saved.id,
        details: { rehearsalId, memberId, previousStatus: existing?.status ?? null, status: 'PRESENT', by: 'SELF' },
      },
    })
    return null
  })
  if (error) throw new RehearsalError(error)
}

export async function markSelfAbsent(rehearsalIdInput: unknown, reason: unknown) {
  const user = await requireUser()
  if (!user.member || isRestricted(user) || !user.consentAcceptedAt) throw new AccessError(403, 'RESTRICTED')
  const memberId = user.member.id
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  const text = attendReasonSchema.parse(reason)
  await prisma.$transaction(async (tx) => {
    const rehearsal = await lockAttendanceContext(tx, rehearsalId, memberId)
    if (rehearsal.status === 'CLOSED' || attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('The attendance window is closed. Absence reasons must be submitted by the scheduled rehearsal end time.')
    }
    const where = { rehearsalId_memberId: { rehearsalId, memberId } }
    const existing = await tx.attendance.findUnique({ where })
    if (existing && existing.status !== 'NO_RESPONSE') throw new RehearsalError('You have already submitted attendance.')
    if (attendanceWindowClosed(rehearsalCutoff(rehearsal.date, rehearsal.endTime))) {
      throw new RehearsalError('The attendance window is closed. Absence reasons must be submitted by the scheduled rehearsal end time.')
    }
    const data = { status: 'ABSENT' as const, markedBy: 'SELF' as const, markedAt: new Date(), reason: text, reviewStatus: 'PENDING' as const, reviewNote: null, reviewedById: null, reviewedAt: null }
    const saved = await tx.attendance.upsert({ where, create: { rehearsalId, memberId, ...data }, update: data })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ABSENCE_REASON_SUBMITTED',
        entity: 'Attendance',
        entityId: saved.id,
        details: { rehearsalId, memberId, reason: text, by: 'SELF' },
      },
    })
  })
}

export async function listMemberHistory(params: { page?: string }) {
  const user = await requireUser()
  const member = user.member
  if (!member) return { records: [], total: 0, page: 1 }
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(params.page ?? '1')
  const [records, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where: { memberId: member.id },
      select: {
        id: true, status: true, reason: true, reviewStatus: true, reviewNote: true, markedBy: true, markedAt: true,
        rehearsal: { select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true } },
      },
      orderBy: { rehearsal: { date: 'desc' } },
      skip: (page - 1) * 20,
      take: 21,
    }),
    prisma.attendance.count({ where: { memberId: member.id } }),
  ])
  return { records, total, page }
}

export async function getAttendanceSheet(rehearsalIdInput: unknown) {
  await requireRole('COMMITTEE')
  const rehearsalId = userIdSchema.parse(rehearsalIdInput)
  const rehearsal = await prisma.rehearsal.findUnique({
    where: { id: rehearsalId },
    select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true, checkInCode: true },
  })
  if (!rehearsal) throw new RehearsalError('Rehearsal not found.')
  const members = await prisma.member.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true, fullName: true, phone: true, joinedAt: true,
      rehearsals: { where: { rehearsalId }, select: { id: true, status: true, markedBy: true, reason: true, reviewStatus: true } },
    },
    orderBy: { fullName: 'asc' },
  })
  return { rehearsal, members }
}

export async function listRehearsals(params: { page?: string; status?: string }) {
  await requireRole('COMMITTEE')
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(params.page ?? '1')
  const statusSchema = z.enum(['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED', '']).catch('')
  const status = statusSchema.parse(params.status ?? '')
  const where: Prisma.RehearsalWhereInput = {

  }
  if (status) where.status = status as RehearsalStatus
  const [rehearsals, total] = await prisma.$transaction([
    prisma.rehearsal.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 21,
      select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true, checkInCode: true },
    }),
    prisma.rehearsal.count({ where }),
  ])
  return { rehearsals, total, page }
}

export async function getMemberRehearsal(input: unknown) {
  const user = await requireUser()
  if (!user.member) return null
  const id = userIdSchema.parse(input)
  const rehearsal = await prisma.rehearsal.findUnique({ where: { id }, select: { id: true, title: true, date: true, startTime: true, endTime: true, venue: true, status: true } })
  if (!rehearsal) return null
  const attendance = await prisma.attendance.findUnique({ where: { rehearsalId_memberId: { rehearsalId: id, memberId: user.member.id } } })
  const end = rehearsalCutoff(rehearsal.date, rehearsal.endTime)
  const windowClosed = attendanceWindowClosed(end)
  const active = user.member.status === 'ACTIVE'
  return { rehearsal, attendance, past: Date.now() >= end.getTime(), attendanceClosed: rehearsal.status === 'CLOSED' || windowClosed,
    canPresent: active && rehearsal.status === 'OPEN' && !windowClosed && attendance?.status !== 'PRESENT',
    canAbsent: active && rehearsal.status !== 'CANCELLED' && rehearsal.status !== 'CLOSED' && !windowClosed && (!attendance || attendance.status === 'NO_RESPONSE'),
  }
}
