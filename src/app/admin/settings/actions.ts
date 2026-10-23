'use server'

import { saveClubSettingsAction as saveSettings } from '@/modules/admin/management-actions'
import type { AdminActionState } from '@/modules/admin/management-actions'

export type { AdminActionState }

export async function saveClubSettingsAction(state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return saveSettings(state, form)
}
