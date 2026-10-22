import { z } from 'zod'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

export const seasonCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a season name.').max(80),
  startDate: dateKey,
  endDate: dateKey,
  memberIds: z.array(z.string().cuid()).max(50, 'Choose no more than 50 members at once.'),
  status: z.enum(['INACTIVE', 'ALUMNI']),
  confirmation: z.literal('ROLLOVER', { errorMap: () => ({ message: 'Type ROLLOVER to confirm.' }) }),
}).strict()
  .refine((value) => value.startDate <= value.endDate, {
    message: 'Season end date must be on or after its start date.',
    path: ['endDate'],
  })
  .refine((value) => new Set(value.memberIds).size === value.memberIds.length, {
    message: 'A member was selected more than once.',
    path: ['memberIds'],
  })

export const seasonMemberListSchema = z.object({
  page: z.number().int().min(1).max(10000),
})

export type SeasonCreateInput = z.infer<typeof seasonCreateSchema>
