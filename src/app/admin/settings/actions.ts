'use server'
import { revalidatePath } from 'next/cache'
import { saveClubSettings, adminManagementError } from '@/lib/admin-management'

export type AdminActionState = { error?: string; success?: boolean; message?: string }

export async function saveClubSettingsAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    await saveClubSettings({
      clubName: form.get('clubName'),
      attendanceThreshold: form.get('attendanceThreshold'),
      absenceDeadlineHours: form.get('absenceDeadlineHours'),
      graceDays: form.get('graceDays'),
      subscriptionBillingPeriod: form.get('subscriptionBillingPeriod'),
    })
    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/settings')
    revalidatePath('/admin/analytics')
    return { success: true }
  } catch (error) { return { error: adminManagementError(error) } }
}
