import type { UserRole } from '@prisma/client'

export const roleLevel: Record<UserRole, number> = { MEMBER: 1, COMMITTEE: 2, SUPER_ADMIN: 3 }

export const permissionRoles = {
  'members:read': 'COMMITTEE',
  'members:manage': 'COMMITTEE',
  'absences:manage': 'COMMITTEE',
  'payments:manage': 'COMMITTEE',
  'fees:manage': 'SUPER_ADMIN',
  'finance:manage': 'COMMITTEE',
  'reimbursements:request': 'MEMBER',
  'seasons:manage': 'SUPER_ADMIN',
  'settings:manage': 'SUPER_ADMIN',
  'team:manage': 'SUPER_ADMIN',
  'meetings:manage': 'COMMITTEE',
  'meetings:read': 'MEMBER',
  'elections:manage': 'COMMITTEE',
  'elections:vote': 'MEMBER',
  'productions:manage': 'COMMITTEE',
  'productions:read': 'MEMBER',
  'festivals:manage': 'COMMITTEE',
} as const satisfies Record<string, UserRole>

export type Permission = keyof typeof permissionRoles

export function hasPermission(role: UserRole, permission: Permission) {
  return roleLevel[role] >= roleLevel[permissionRoles[permission]]
}
