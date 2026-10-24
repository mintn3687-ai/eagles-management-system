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

export const festivalBudgetItemSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().trim().min(2, 'Enter a budget category.').max(120),
  plannedAmount: z.number().int().safe().positive('Enter a positive amount in KES.').max(2_147_483_647),
  notes: z.string().trim().max(1000).default(''),
}).strict()

export const festivalBudgetItemUpdateSchema = festivalBudgetItemSchema.extend({
  budgetItemId: z.string().trim().min(1).max(191),
}).strict()

export const festivalFinanceLinkSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  budgetItemId: z.string().trim().min(1).max(191),
  financeEntryId: z.string().trim().min(1).max(191),
}).strict()

export const festivalPlanApprovalSubmitSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
}).strict()

export const festivalBudgetApprovalSubmitSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  budgetItemId: z.string().trim().min(1).max(191),
}).strict()

export const festivalApprovalDecisionSchema = z.object({
  approvalId: z.string().trim().min(1).max(191),
  decision: z.enum(['APPROVED', 'REJECTED']),
  approvedAmount: z.number().int().safe().positive().max(2_147_483_647).nullable(),
  reason: z.string().trim().max(1000).default(''),
}).strict()

export const festivalFinanceUnlinkSchema = z.object({
  festivalId: z.string().trim().min(1).max(191),
  linkId: z.string().trim().min(1).max(191),
}).strict()

export type FestivalCreateInput = z.infer<typeof festivalCreateSchema>
export type FestivalUpdateInput = z.infer<typeof festivalUpdateSchema>
export type FestivalInvitationCreateInput = z.infer<typeof invitationCreateSchema>
export type EntryCategoryInput = z.infer<typeof entryCategorySchema>
export type EntryCategoryUpdateInput = z.infer<typeof entryCategoryUpdateSchema>
export type FestivalEntryCreateInput = z.infer<typeof festivalEntryCreateSchema>
export type FestivalBudgetItemInput = z.infer<typeof festivalBudgetItemSchema>
export type FestivalBudgetItemUpdateInput = z.infer<typeof festivalBudgetItemUpdateSchema>
export type FestivalFinanceLinkInput = z.infer<typeof festivalFinanceLinkSchema>
export type FestivalFinanceUnlinkInput = z.infer<typeof festivalFinanceUnlinkSchema>
export type FestivalPlanApprovalSubmitInput = z.infer<typeof festivalPlanApprovalSubmitSchema>
export type FestivalBudgetApprovalSubmitInput = z.infer<typeof festivalBudgetApprovalSubmitSchema>
export type FestivalApprovalDecisionInput = z.infer<typeof festivalApprovalDecisionSchema>
