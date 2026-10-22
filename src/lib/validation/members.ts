import { z } from 'zod'
import { emailSchema, phoneSchema } from './index'

export const memberStatuses = ['PENDING_REGISTRATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ALUMNI'] as const
export const memberStatusSchema = z.enum(memberStatuses)
const name = z.string().trim().min(2, 'Enter a name with at least 2 characters.').max(100)
export const memberDetailsSchema = z.object({
  fullName: name, phone: phoneSchema, email: emailSchema,
  studentRegNo: z.string().trim().max(50).default(''),
  emergencyContactName: name,
  emergencyContactPhone: phoneSchema,
  notes: z.string().trim().max(2000).default(''),
}).strict()
export const memberCreateSchema = memberDetailsSchema.extend({ existingMember: z.boolean() })
export const csvMemberSchema = memberDetailsSchema.pick({ fullName: true, phone: true, email: true, studentRegNo: true })
export const statusChangeSchema = z.object({
  status: memberStatusSchema, reason: z.string().trim().max(1000).default(''),
}).strict().refine((v) => !['INACTIVE', 'SUSPENDED'].includes(v.status) || v.reason.length >= 3, {
  path: ['reason'], message: 'Give a reason for making a member inactive or suspended.',
})
export const roleChangeSchema = z.object({ role: z.enum(['MEMBER', 'COMMITTEE']) }).strict()
export const memberListSchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.union([memberStatusSchema, z.literal('')]).default(''),
  sort: z.enum(['name', 'joined']).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
export type MemberFilters = z.infer<typeof memberListSchema>
