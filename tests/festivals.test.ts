import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import {
  entryCategorySchema,
  festivalCreateSchema,
  festivalEntryCreateSchema,
  festivalUpdateSchema,
  invitationCreateSchema,
} from '../src/modules/festivals/schema'
import {
  canTransitionEntry,
  isEntryOverdue,
  isInvitationOverdue,
} from '../src/modules/festivals/rules'

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

  it('accepts user-configured categories, invitation dates, and production-linked entries', () => {
    expect(entryCategorySchema.safeParse({
      festivalId: 'festival-id',
      name: 'Original play',
      defaultDeadline: '2027-03-01',
    }).success).toBe(true)
    expect(invitationCreateSchema.safeParse({
      festivalId: 'festival-id',
      receivedAt: '2027-01-20',
      responseDeadline: '2027-02-10',
      notes: '',
    }).success).toBe(true)
    expect(invitationCreateSchema.safeParse({
      festivalId: 'festival-id',
      receivedAt: '2027-02-10',
      responseDeadline: '2027-01-20',
      notes: '',
    }).success).toBe(false)
    expect(festivalEntryCreateSchema.safeParse({
      festivalId: 'festival-id',
      categoryId: 'category-id',
      productionId: 'production-id',
      itemTitle: 'The River',
      deadline: '',
      notes: '',
    }).success).toBe(true)
  })

  it('enforces forward entry status changes and computes overdue states from configured dates', () => {
    expect(canTransitionEntry('PENDING', 'PREPARING')).toBe(true)
    expect(canTransitionEntry('SUBMITTED', 'CONFIRMED')).toBe(true)
    expect(canTransitionEntry('CONFIRMED', 'PREPARING')).toBe(false)
    expect(isEntryOverdue('PREPARING', '2027-03-01', '2027-03-02')).toBe(true)
    expect(isEntryOverdue('SUBMITTED', '2027-03-01', '2027-03-02')).toBe(false)
    expect(isEntryOverdue('PREPARING', '2027-03-02', '2027-03-02')).toBe(false)
    expect(isInvitationOverdue('RECEIVED', '2027-02-01', '2027-02-02')).toBe(true)
    expect(isInvitationOverdue('ACCEPTED', '2027-02-01', '2027-02-02')).toBe(false)
  })

  it('restricts festival planning to committee and super admins', () => {
    expect(hasPermission('MEMBER', 'festivals:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'festivals:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'festivals:manage')).toBe(true)
  })
})
