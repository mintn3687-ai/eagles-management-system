import 'server-only'
import { writeAuditLog } from '@/lib/audit'
import { absencesRepository } from './repository'
import type { AbsenceFilters } from './schema'
import { AbsenceError } from './errors'

export type AbsenceListItem = Awaited<ReturnType<typeof listAbsences>>['records'][number]
export type ReviewAction = 'EXCUSE' | 'UNEXCUSE' | 'MARK_PRESENT'

export async function listAbsences(filters: AbsenceFilters) {
  const { records, total } = await absencesRepository.list(filters, filters.page)
  return { records, total, page: filters.page }
}

export async function countPendingAbsences() {
  return absencesRepository.pendingCount()
}

async function reviewOne(
  tx: Parameters<typeof absencesRepository.findContext>[0],
  attendanceId: string,
  action: ReviewAction,
  note: string | undefined,
  actorId: string,
) {
  const context = await absencesRepository.findContext(tx, attendanceId)
  if (!context) throw new AbsenceError('Record not found.')
  await absencesRepository.lockRehearsal(tx, context.rehearsalId)
  await absencesRepository.lockMember(tx, context.memberId)
  const rehearsal = await absencesRepository.findRehearsalStatus(tx, context.rehearsalId)
  if (action === 'MARK_PRESENT' && rehearsal?.status === 'CANCELLED') {
    throw new AbsenceError('Cancelled rehearsals cannot be marked.')
  }
  if (action === 'MARK_PRESENT') {
    const member = await absencesRepository.findMemberStatus(tx, context.memberId)
    if (member?.status !== 'ACTIVE') throw new AbsenceError('Only ACTIVE members can be marked present.')
  }
  const attendance = await absencesRepository.findAttendance(tx, attendanceId)
  if (!attendance) throw new AbsenceError('Record not found.')
  if (attendance.status === 'PRESENT') throw new AbsenceError('Present records cannot be reviewed.')
  if (attendance.reviewStatus !== 'PENDING') throw new AbsenceError('This record has already been reviewed.')
  if (action === 'MARK_PRESENT' && attendance.status !== 'NO_RESPONSE') {
    throw new AbsenceError('Only NO_RESPONSE records can be changed to PRESENT.')
  }

  const status = action === 'MARK_PRESENT' ? 'PRESENT' : attendance.status
  const reviewStatus = action === 'MARK_PRESENT' ? 'NONE' : action === 'EXCUSE' ? 'EXCUSED' : 'UNEXCUSED'
  const reviewedAt = new Date()
  await absencesRepository.updateAttendance(tx, attendanceId, {
    status,
    ...(action === 'MARK_PRESENT' ? { markedBy: 'COMMITTEE', markedAt: reviewedAt } : {}),
    reviewStatus,
    reviewNote: note ?? null,
    reviewedById: actorId,
    reviewedAt,
  })
  await writeAuditLog(tx, {
    actorId,
    action: action === 'MARK_PRESENT' ? 'ATTENDANCE_MARKED_PRESENT' : 'ABSENCE_REVIEWED',
    entity: 'Attendance',
    entityId: attendanceId,
    details: { action, reviewStatus, note: note ?? null, rehearsalId: attendance.rehearsalId, memberId: attendance.memberId },
  })
}

export async function reviewSingle(input: {
  attendanceId: string
  action: ReviewAction
  note?: string
}, actorId: string) {
  await absencesRepository.transaction((tx) => reviewOne(tx, input.attendanceId, input.action, input.note, actorId))
}

export async function reviewBulk(input: {
  attendanceIds: string[]
  action: ReviewAction
  note?: string
}, actorId: string) {
  await absencesRepository.transaction(async (tx) => {
    for (const attendanceId of [...new Set(input.attendanceIds)].sort()) {
      await reviewOne(tx, attendanceId, input.action, input.note, actorId)
    }
  })
}

export async function getAbsenceStats(filters: AbsenceFilters) {
  return absencesRepository.stats(filters)
}

export { isExcused, countsAgainstAnalytics } from '@/lib/absences/counting'
