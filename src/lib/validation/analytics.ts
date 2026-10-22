import { z } from 'zod'

export const analyticsMonthSchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.')
  .refine((value) => {
    const date = new Date(`${value}-01T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 7) === value
  }, 'Choose a valid month.')

export const analyticsSortSchema = z.enum(['name', 'counted', 'present', 'excused', 'missed', 'attendance'])
export const analyticsDirectionSchema = z.enum(['asc', 'desc'])
