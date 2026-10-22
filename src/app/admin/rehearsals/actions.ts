'use server'
import { revalidatePath } from 'next/cache'
import {
  createRehearsal, editRehearsal, cancelRehearsal, openSession, closeSession,
  setManualAttendance, previewWeekly, generateWeekly, rehearsalErrorMessage,
} from '@/lib/rehearsals/service'

export type RehearsalFormState = { error?: string; success?: boolean; checkInCode?: string; createdRows?: number }
export type WeeklyPreviewState = { error?: string; preview?: { weekday: string; time: string; dates: string[] }; venue?: string; created?: string[]; weekday?: string; startTime?: string; endTime?: string; startDate?: string; endDate?: string }

function rehearsalForm(from: FormData) {
  return {
    title: formString(from, 'title'),
    date: formString(from, 'date'),
    startTime: formString(from, 'startTime'),
    endTime: formString(from, 'endTime'),
    venue: formString(from, 'venue'),
  }
}

function formString(from: FormData, key: string): string {
  const v = from.get(key)
  return typeof v === 'string' ? v : ''
}

export async function createRehearsalAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    await createRehearsal(rehearsalForm(form))
    revalidatePath('/admin/rehearsals')
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function editRehearsalAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    await editRehearsal(form.get('rehearsalId'), rehearsalForm(form))
    revalidatePath('/admin/rehearsals')
    revalidatePath(`/admin/rehearsals/${form.get('rehearsalId')}`)
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function cancelRehearsalAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    await cancelRehearsal(form.get('rehearsalId'), form.get('reason'))
    revalidatePath('/admin/rehearsals')
    revalidatePath(`/admin/rehearsals/${form.get('rehearsalId')}`)
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function openSessionAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    const result = await openSession(form.get('rehearsalId'))
    revalidatePath('/admin/rehearsals')
    revalidatePath(`/admin/rehearsals/${form.get('rehearsalId')}`)
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true, checkInCode: result.checkInCode }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function closeSessionAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    const result = await closeSession(form.get('rehearsalId'))
    revalidatePath('/admin/rehearsals')
    revalidatePath(`/admin/rehearsals/${form.get('rehearsalId')}`)
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true, createdRows: result.createdRows }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function setManualAttendanceAction(_state: RehearsalFormState, form: FormData): Promise<RehearsalFormState> {
  try {
    await setManualAttendance(form.get('rehearsalId'), form.get('memberId'), form.get('status'), form.get('note'))
    revalidatePath(`/admin/rehearsals/${form.get('rehearsalId')}`)
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function previewWeeklyAction(_state: WeeklyPreviewState, form: FormData): Promise<WeeklyPreviewState> {
  try {
    const data = {
      weekday: formString(form, 'weekday'),
      startTime: formString(form, 'startTime'),
      endTime: formString(form, 'endTime'),
      startDate: formString(form, 'startDate'),
      endDate: formString(form, 'endDate'),
    }
    const preview = await previewWeekly(data)
    return { preview, venue: formString(form, 'venue'), weekday: data.weekday, startTime: data.startTime, endTime: data.endTime, startDate: data.startDate, endDate: data.endDate }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function generateWeeklyAction(_state: WeeklyPreviewState, form: FormData): Promise<WeeklyPreviewState> {
  try {
    const data = {
      weekday: formString(form, 'weekday'),
      startTime: formString(form, 'startTime'),
      endTime: formString(form, 'endTime'),
      startDate: formString(form, 'startDate'),
      endDate: formString(form, 'endDate'),
    }
    const result = await generateWeekly(data, formString(form, 'venue'))
    revalidatePath('/admin/rehearsals')
    return { created: result.created }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}
