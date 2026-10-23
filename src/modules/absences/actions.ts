'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import { absenceErrorMessage } from './errors'
import { reviewBulkSchema, reviewSingleSchema } from './schema'
import { reviewBulk, reviewSingle } from './service'

export type AbsenceListState = { error?: string; success?: boolean }

function formString(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function revalidateAttendanceViews() {
  revalidatePath('/admin/absences')
  revalidatePath('/admin', 'layout')
  revalidatePath('/member', 'layout')
}

export async function reviewSingleAction(_state: AbsenceListState, form: FormData): Promise<AbsenceListState> {
  try {
    const actor = await requirePermission('absences:manage')
    const parsed = reviewSingleSchema.safeParse({
      attendanceId: formString(form, 'attendanceId'),
      action: formString(form, 'action'),
      note: formString(form, 'note') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the review details.' }
    await reviewSingle(parsed.data, actor.id)
    revalidateAttendanceViews()
    return { success: true }
  } catch (error) { return { error: error instanceof AccessError ? error.message : absenceErrorMessage(error) } }
}

export async function reviewBulkAction(_state: AbsenceListState, form: FormData): Promise<AbsenceListState> {
  try {
    const actor = await requirePermission('absences:manage')
    const parsed = reviewBulkSchema.safeParse({
      attendanceIds: form.getAll('attendanceIds').filter((value): value is string => typeof value === 'string' && value.length > 0),
      action: formString(form, 'action'),
      note: formString(form, 'note') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the selected records.' }
    await reviewBulk(parsed.data, actor.id)
    revalidateAttendanceViews()
    return { success: true }
  } catch (error) { return { error: error instanceof AccessError ? error.message : absenceErrorMessage(error) } }
}
