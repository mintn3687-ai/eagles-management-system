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

export type FestivalCreateInput = z.infer<typeof festivalCreateSchema>
export type FestivalUpdateInput = z.infer<typeof festivalUpdateSchema>
