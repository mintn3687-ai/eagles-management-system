'use server'
import { revalidatePath } from 'next/cache'
import { changeTeamRole, transferSuperAdmin, adminManagementError } from '@/lib/admin-management'
import type { AdminActionState } from '../settings/actions'

export async function changeTeamRoleAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    await changeTeamRole({ memberId: form.get('memberId'), role: form.get('role') })
    revalidatePath('/admin/team')
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: adminManagementError(error) } }
}

export async function transferSuperAdminAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    await transferSuperAdmin({ memberId: form.get('memberId'), confirmation: form.get('confirmation') })
    revalidatePath('/admin/team')
    revalidatePath('/admin', 'layout')
    return { success: true }
  } catch (error) { return { error: adminManagementError(error) } }
}
