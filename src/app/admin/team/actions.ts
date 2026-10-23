'use server'

import {
  changeTeamRoleAction as changeRole,
  transferSuperAdminAction as transferAdmin,
} from '@/modules/admin/management-actions'
import type { AdminActionState } from '@/modules/admin/management-actions'

export async function changeTeamRoleAction(state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return changeRole(state, form)
}

export async function transferSuperAdminAction(state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return transferAdmin(state, form)
}
