import { z } from 'zod'
import { userIdSchema } from './index'

export const reviewActionSchema = z.enum(['EXCUSE', 'UNEXCUSE', 'MARK_PRESENT'])

export const reviewSingleSchema = z.object({
  attendanceId: userIdSchema,
  action: reviewActionSchema,
  note: z.string().trim().max(1000).optional(),
}).refine((v) => v.action !== 'MARK_PRESENT' || (v.note && v.note.length >= 3), {
  message: 'A note is required when marking present.',
  path: ['note'],
})

export const reviewBulkSchema = z.object({
  attendanceIds: z.array(userIdSchema).min(1, 'Select at least one record.').max(50, 'Maximum 50 records at once.'),
  action: reviewActionSchema,
  note: z.string().trim().max(1000).optional(),
}).refine((v) => v.action !== 'MARK_PRESENT' || (v.note && v.note.length >= 3), {
  message: 'A note is required when marking present.',
  path: ['note'],
})

export const absenceListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
  rehearsalId: z.union([userIdSchema, z.literal('')]).catch('').default(''),
  memberId: z.union([userIdSchema, z.literal('')]).catch('').default(''),
  status: z.union([z.enum(['ABSENT', 'NO_RESPONSE']), z.literal('')]).catch('').default(''),
  month: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), z.literal('')]).catch('').default(''),
})

export type AbsenceFilters = z.infer<typeof absenceListSchema>