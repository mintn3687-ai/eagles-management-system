'use server'
import { revalidatePath } from 'next/cache'
import { reviewSingle, reviewBulk, absenceErrorMessage } from '@/lib/absences/service'

export type AbsenceListState = { error?: string; success?: boolean }

export async function reviewSingleAction(_state: AbsenceListState, form: FormData): Promise<AbsenceListState> {
  try {
    await reviewSingle(form.get('attendanceId'), form.get('action'), form.get('note') ?? undefined)
    revalidatePath('/admin/absences')
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: absenceErrorMessage(error) } }
}

export async function reviewBulkAction(_state: AbsenceListState, form: FormData): Promise<AbsenceListState> {
  try {
    const ids = form.getAll('attendanceIds').filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (ids.length === 0) return { error: 'Select at least one record.' }
    await reviewBulk(ids, form.get('action'), form.get('note') ?? undefined)
    revalidatePath('/admin/absences')
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: absenceErrorMessage(error) } }
}