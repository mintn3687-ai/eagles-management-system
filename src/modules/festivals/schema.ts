import { z } from 'zod'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

const optionalDate = z.union([dateKey, z.literal('')]).transform((value) => value || null)

export const festivalCreateSchema = z.object({
  name: z.string().trim().min(3, 'Enter a festival name.').max(160),
  year: z.number().int().min(1900).max(2200),
  organizer: z.string().trim().max(160).default(''),
  venue: z.string().trim().max(160).default(''),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: z.string().trim().max(2000).default(''),
}).strict().refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: 'End date must be on or after the start date.',
  path: ['endDate'],
})

export const festivalUpdateSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  name: z.string().trim().min(3, 'Enter a festival name.').max(160),
  year: z.number().int().min(1900).max(2200),
  organizer: z.string().trim().max(160).default(''),
  venue: z.string().trim().max(160).default(''),
  startDate: optionalDate,
  endDate: optionalDate,
  status: z.enum(['DRAFT', 'PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
  notes: z.string().trim().max(2000).default(''),
}).strict().refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: 'End date must be on or after the start date.',
  path: ['endDate'],
})

export const invitationCreateSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  receivedAt: dateKey,
  responseDeadline: optionalDate,
  notes: z.string().trim().max(2000).default(''),
}).strict().refine((value) => !value.responseDeadline || value.receivedAt <= value.responseDeadline, {
  message: 'Response deadline must be on or after the received date.',
  path: ['responseDeadline'],
})

export const invitationStatusSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  invitationId: z.string().trim().min(1).max(191),
  status: z.enum(['ACCEPTED', 'DECLINED']),
}).strict()

export const entryCategorySchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  name: z.string().trim().min(2, 'Enter a category name.').max(120),
  defaultDeadline: optionalDate,
}).strict()

export const entryCategoryUpdateSchema = entryCategorySchema.extend({
  categoryId: z.string().trim().min(1).max(191),
}).strict()

export const festivalEntryCreateSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  categoryId: z.string().trim().min(1).max(191),
  productionId: z.union([z.string().trim().min(1).max(191), z.literal('')]).default(''),
  itemTitle: z.string().trim().min(3, 'Enter the production or performance item.').max(160),
  deadline: optionalDate,
  notes: z.string().trim().max(2000).default(''),
}).strict()

export const festivalEntryStatusSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  entryId: z.string().trim().min(1).max(191),
  status: z.enum(['PREPARING', 'SUBMITTED', 'CONFIRMED', 'REJECTED']),
}).strict()

export type FestivalCreateInput = z.infer<typeof festivalCreateSchema>
export type FestivalUpdateInput = z.infer<typeof festivalUpdateSchema>
export type FestivalInvitationCreateInput = z.infer<typeof invitationCreateSchema>
export type EntryCategoryInput = z.infer<typeof entryCategorySchema>
export type EntryCategoryUpdateInput = z.infer<typeof entryCategoryUpdateSchema>
export type FestivalEntryCreateInput = z.infer<typeof festivalEntryCreateSchema>
