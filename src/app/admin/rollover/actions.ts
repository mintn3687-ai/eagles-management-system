'use server'
import { revalidatePath } from 'next/cache'
import { rolloverMembers, adminManagementError } from '@/lib/admin-management'
import type { AdminActionState } from '../settings/actions'

export async function rolloverMembersAction(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const count = await rolloverMembers({
      memberIds: form.getAll('memberIds'),
      status: form.get('status'),
      confirmation: form.get('confirmation'),
    })
    revalidatePath('/admin/rollover')
    revalidatePath('/admin/members', 'layout')
    revalidatePath('/admin/analytics', 'layout')
    return { success: true, message: `${count} member${count === 1 ? '' : 's'} updated.` }
  } catch (error) { return { error: adminManagementError(error) } }
}
