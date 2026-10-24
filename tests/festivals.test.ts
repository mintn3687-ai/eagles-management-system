import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import { festivalCreateSchema, festivalUpdateSchema } from '../src/modules/festivals/schema'

const createInput = {
  name: 'Kenya National Drama Festivals',
  year: 2027,
  organizer: 'Kenya National Drama Festivals',
  venue: 'Nairobi',
  startDate: '2027-04-10',
  endDate: '2027-04-14',
  notes: '',
}

describe('festival planning foundation', () => {
  it('accepts an upcoming festival with valid details', () => {
    expect(festivalCreateSchema.safeParse(createInput).success).toBe(true)
  })

  it('rejects invalid years, dates, and reversed date ranges', () => {
    expect(festivalCreateSchema.safeParse({ ...createInput, year: 1899 }).success).toBe(false)
    expect(festivalCreateSchema.safeParse({ ...createInput, startDate: '2027-02-30' }).success).toBe(false)
    expect(festivalCreateSchema.safeParse({ ...createInput, startDate: '2027-04-15' }).success).toBe(false)
  })

  it('validates festival edits and status values', () => {
    expect(festivalUpdateSchema.safeParse({
      ...createInput,
      festivalId: 'festival-id',
      status: 'CONFIRMED',
    }).success).toBe(true)
    expect(festivalUpdateSchema.safeParse({
      ...createInput,
      festivalId: 'festival-id',
      status: 'SUBMITTED',
    }).success).toBe(false)
  })

  it('restricts festival planning to committee and super admins', () => {
    expect(hasPermission('MEMBER', 'festivals:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'festivals:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'festivals:manage')).toBe(true)
  })
})
