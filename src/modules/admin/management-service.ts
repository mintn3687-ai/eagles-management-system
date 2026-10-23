import 'server-only'
import {
  changeTeamRole as persistTeamRole,
  saveClubSettings as persistClubSettings,
  transferSuperAdmin as persistSuperAdminTransfer,
} from './management-repository'
import type { ClubSettings } from '@/lib/validation/admin'
import type { teamRoleChangeSchema, transferAdminSchema } from '@/lib/validation/admin'
import type { z } from 'zod'

export { AdminManagementError } from './management-repository'

type TeamRoleChange = z.infer<typeof teamRoleChangeSchema>
type AdminTransfer = z.infer<typeof transferAdminSchema>

export const saveClubSettings = (actorId: string, settings: ClubSettings) => persistClubSettings(actorId, settings)
export const changeTeamRole = (actorId: string, data: TeamRoleChange) => persistTeamRole(actorId, data)
export const transferSuperAdmin = (actorId: string, data: AdminTransfer) => persistSuperAdminTransfer(actorId, data)
