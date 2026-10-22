import { z } from 'zod'
import { userIdSchema } from './index'

const wholeNumber = (minimum: number, maximum: number) => z.preprocess(
  (value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(minimum).max(maximum),
)

export const clubSettingsSchema = z.object({
  clubName: z.string().trim().min(2, 'Enter a club name.').max(80),
  attendanceThreshold: wholeNumber(0, 100),
  absenceDeadlineHours: wholeNumber(0, 720),
  graceDays: wholeNumber(0, 90),
  subscriptionBillingPeriod: z.enum(['MONTHLY', 'TERM', 'YEAR']),
}).strict()

export const teamRoleChangeSchema = z.object({
  memberId: userIdSchema,
  role: z.enum(['MEMBER', 'COMMITTEE']),
}).strict()

export const adminConfirmationSchema = z.literal('TRANSFER', { errorMap: () => ({ message: 'Type TRANSFER to confirm.' }) })
export const transferAdminSchema = z.object({
  memberId: userIdSchema,
  confirmation: adminConfirmationSchema,
}).strict()

export const seasonRolloverSchema = z.object({
  memberIds: z.array(userIdSchema).min(1, 'Select at least one member.').max(50, 'Choose no more than 50 members at once.'),
  status: z.enum(['INACTIVE', 'ALUMNI']),
  confirmation: z.literal('ROLLOVER', { errorMap: () => ({ message: 'Type ROLLOVER to confirm.' }) }),
}).strict().refine((data) => new Set(data.memberIds).size === data.memberIds.length, {
  message: 'A member was selected more than once.', path: ['memberIds'],
})

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

export const auditFilterSchema = z.object({
  q: z.string().trim().max(100).default(''),
  from: z.union([dateKey, z.literal('')]).default(''),
  to: z.union([dateKey, z.literal('')]).default(''),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
}).refine((filters) => !filters.from || !filters.to || filters.from <= filters.to, {
  message: 'End date must be on or after start date.', path: ['to'],
})

export type ClubSettings = z.infer<typeof clubSettingsSchema>
