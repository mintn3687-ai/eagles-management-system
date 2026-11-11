'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  clubSettingsSchema,
  teamRoleChangeSchema,
  transferAdminSchema,
} from '@/lib/validation/admin'
import { AdminManagementError, changeTeamRole, saveClubSettings, transferSuperAdmin } from './management-service'

export type AdminActionState = { error?: string; success?: boolean; message?: string }

function errorMessage(error: unknown) {
  if (error instanceof AccessError || error instanceof AdminManagementError) return error.message
  return 'Could not save this change. Please try again.'
}

export async function saveClubSettingsAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const actor = await requirePermission('settings:manage')
    const parsed = clubSettingsSchema.safeParse({
      clubName: form.get('clubName'),
      attendanceThreshold: form.get('attendanceThreshold'),
      graceDays: form.get('graceDays'),
      subscriptionBillingPeriod: form.get('subscriptionBillingPeriod'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the settings and try again.' }
    await saveClubSettings(actor.id, parsed.data)
    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/settings')
    revalidatePath('/admin/analytics')
    return { success: true }
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

export async function changeTeamRoleAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const actor = await requirePermission('team:manage')
    const parsed = teamRoleChangeSchema.safeParse({ memberId: form.get('memberId'), role: form.get('role') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the role change and try again.' }
    await changeTeamRole(actor.id, parsed.data)
    revalidatePath('/admin/team')
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

export async function transferSuperAdminAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const actor = await requirePermission('team:manage')
    const parsed = transferAdminSchema.safeParse({ memberId: form.get('memberId'), confirmation: form.get('confirmation') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the transfer details and try again.' }
    await transferSuperAdmin(actor.id, parsed.data)
    revalidatePath('/admin/team')
    revalidatePath('/admin', 'layout')
    return { success: true }
  } catch (error) {
    return { error: errorMessage(error) }
  }
}
