import { z } from 'zod'
import { userIdSchema } from './index'
import { nairobiDateKey, parseNairobiDate } from '../dates'

export const rehearsalDateSchema = z.string().min(1, 'Enter a valid date.').refine((val) => {
  try {
    const d = parseNairobiDate(val)
    return nairobiDateKey(d) >= nairobiDateKey()
  } catch {
    return false
  }
}, { message: 'Enter a valid date on or after today.' })

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
const timeStringSchema = z.string().regex(timeRegex, 'Enter a valid time in 24-hour format (e.g. 18:30).')

const rehearsalBaseSchema = z.object({
  title: z.string().trim().min(2, 'Enter a title of at least 2 characters.').max(100),
  date: rehearsalDateSchema,
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  venue: z.string().trim().min(2, 'Enter a venue.').max(200),
})

export const rehearsalCreateSchema = rehearsalBaseSchema.refine((v) => v.endTime > v.startTime, {
  message: 'Rehearsal end time must be after the start time.', path: ['endTime'],
})

export const rehearsalEditSchema = rehearsalBaseSchema.extend({
  rehearsalId: userIdSchema,
}).refine((v) => v.endTime > v.startTime, {
  message: 'Rehearsal end time must be after the start time.', path: ['endTime'],
})

export const weeklyGenerateSchema = z.object({
  weekday: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  startDate: rehearsalDateSchema,
  endDate: rehearsalDateSchema,
}).refine((v) => parseNairobiDate(v.endDate).getTime() - parseNairobiDate(v.startDate).getTime() <= 366 * 86400000, { message: 'Generate at most one year at a time.' }).refine((v) => v.endDate >= v.startDate, { message: 'End date cannot be before start date.' })
  .refine((v) => v.endTime > v.startTime, {
    message: 'End time must be after the start time.', path: ['endTime'],
  })

export const checkInCodeSchema = z.string().regex(/^\d{4}$/, 'Enter the 4-digit code shown on the screen.')

export const attendReasonSchema = z.string().trim().min(10, 'Enter a reason of at least 10 characters.').max(1000)
