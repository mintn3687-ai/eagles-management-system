'use server'
import { revalidatePath } from 'next/cache'
import { markSelfPresent, markSelfAbsent } from '@/lib/rehearsals/service'
import { rehearsalErrorMessage } from '@/lib/rehearsals/service'

export type MemberAttendanceState = { error?: string; success?: boolean; message?: string }

export async function markPresentAction(_state: MemberAttendanceState, form: FormData): Promise<MemberAttendanceState> {
  try {
    await markSelfPresent(form.get('rehearsalId'), form.get('code'))
    revalidatePath('/member')
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}

export async function markAbsentAction(_state: MemberAttendanceState, form: FormData): Promise<MemberAttendanceState> {
  try {
    await markSelfAbsent(form.get('rehearsalId'), form.get('reason'))
    revalidatePath('/member')
    revalidatePath('/admin', 'layout')
    revalidatePath('/member', 'layout')
    return { success: true }
  } catch (error) { return { error: rehearsalErrorMessage(error) } }
}
