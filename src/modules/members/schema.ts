import {
  memberCreateSchema,
  memberDetailsSchema,
  statusChangeSchema,
} from '@/lib/validation/members'
import { z } from 'zod'

export {
  memberCreateSchema,
  memberDetailsSchema,
  memberListSchema,
  roleChangeSchema,
  statusChangeSchema,
} from '@/lib/validation/members'
export type { MemberFilters } from '@/lib/validation/members'
export type MemberCreateInput = import('zod').infer<typeof memberCreateSchema>
export type MemberDetailsInput = import('zod').infer<typeof memberDetailsSchema>
export type MemberStatusInput = import('zod').infer<typeof statusChangeSchema>
export const memberImportSourceSchema = z.string().min(1).max(512000)
