import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/lib/permission-rules'
import {
  entryCategorySchema,
  festivalBudgetItemSchema,
  festivalApprovalDecisionSchema,
  festivalBudgetApprovalSubmitSchema,
  festivalCreateSchema,
  festivalFinanceLinkSchema,
  festivalEntryCreateSchema,
  festivalUpdateSchema,
  invitationCreateSchema,
} from '../src/modules/festivals/schema'
import {
  canTransitionEntry,
  isEntryOverdue,
  isInvitationOverdue,
  summarizeFestivalBudget,
  validateBudgetApprovalAmount,
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

  it('validates festival budget amounts and explicit finance entry links', () => {
    expect(festivalBudgetItemSchema.safeParse({
      festivalId: 'festival-id',
      type: 'EXPENSE',
      category: 'Transport',
      plannedAmount: 50000,
      notes: '',
    }).success).toBe(true)
    expect(festivalBudgetItemSchema.safeParse({
      festivalId: 'festival-id',
      type: 'EXPENSE',
      category: 'Transport',
      plannedAmount: 12.5,
      notes: '',
    }).success).toBe(false)
    expect(festivalFinanceLinkSchema.safeParse({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
      financeEntryId: 'finance-entry-id',
    }).success).toBe(true)
  })

  it('summarizes planned and actual KES separately for budget income and expenses', () => {
    expect(summarizeFestivalBudget([
      { type: 'INCOME', plannedAmount: 100000, approvedAmount: 80000, actualAmount: 20000 },
      { type: 'EXPENSE', plannedAmount: 80000, approvedAmount: 60000, actualAmount: 85000 },
      { type: 'EXPENSE', plannedAmount: 10000, actualAmount: 0 },
    ])).toEqual({
      INCOME: { planned: 100000, approved: 80000, actual: 20000 },
      EXPENSE: { planned: 90000, approved: 60000, actual: 85000 },
    })
  })

  it('validates approval decisions, budget reductions, and approver permissions', () => {
    expect(festivalBudgetApprovalSubmitSchema.safeParse({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
    }).success).toBe(true)
    expect(festivalApprovalDecisionSchema.safeParse({
      approvalId: 'approval-id',
      decision: 'APPROVED',
      approvedAmount: 40000,
      reason: '',
    }).success).toBe(true)
    expect(validateBudgetApprovalAmount(50000, 50000, '')).toBeUndefined()
    expect(validateBudgetApprovalAmount(50000, 40000, 'Reduced costs')).toBeUndefined()
    expect(() => validateBudgetApprovalAmount(50000, 60000, '')).toThrow(/cannot exceed/)
    expect(() => validateBudgetApprovalAmount(50000, 40000, '')).toThrow(/Explain why/)

    expect(hasPermission('MEMBER', 'festivals:approve')).toBe(false)
    expect(hasPermission('COMMITTEE', 'festivals:approve')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'festivals:approve')).toBe(true)
  })

  it('restricts festival planning to committee and super admins', () => {
    expect(hasPermission('MEMBER', 'festivals:manage')).toBe(false)
    expect(hasPermission('COMMITTEE', 'festivals:manage')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'festivals:manage')).toBe(true)
  })
})
