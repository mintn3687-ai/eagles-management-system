import { z } from 'zod'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

const financeIdSchema = z.string().trim().min(1).max(191)
const optionalId = z.union([financeIdSchema, z.literal('')]).default('')
const positiveAmount = z.number().int().safe().positive('Amount must be a positive whole number of KES.').max(2_147_483_647)
const reference = z.string().trim().max(120).default('')

export const budgetSchema = z.object({
  seasonId: optionalId,
  productionId: optionalId,
  category: z.string().trim().min(2).max(80),
  amount: positiveAmount,
  notes: z.string().trim().max(1000).default(''),
}).strict().refine((data) => data.seasonId || data.productionId, {
  message: 'Choose a season, production, or both.',
})

export const financeEntrySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  seasonId: optionalId,
  productionId: optionalId,
  category: z.string().trim().min(2).max(80),
  amount: positiveAmount,
  description: z.string().trim().min(3).max(500),
  receiptReference: reference,
  date: dateKey,
}).strict()

export const reimbursementRequestSchema = z.object({
  amount: positiveAmount,
  reason: z.string().trim().min(5).max(1000),
  receiptReference: reference,
  seasonId: optionalId,
  productionId: optionalId,
}).strict()

export const reimbursementDecisionSchema = z.object({
  reimbursementId: financeIdSchema,
  decision: z.enum(['APPROVED', 'REJECTED']),
}).strict()

export const reimbursementPaySchema = z.object({
  reimbursementId: financeIdSchema,
  paymentReference: z.string().trim().min(1).max(120),
}).strict()

export const campaignSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  goalAmount: positiveAmount,
  seasonId: optionalId,
  productionId: optionalId,
}).strict()

export const contributionSchema = z.object({
  campaignId: optionalId,
  type: z.enum(['DONATION', 'SPONSORSHIP']),
  contributor: z.string().trim().max(160).default(''),
  amount: positiveAmount,
  method: z.enum(['MPESA', 'CASH', 'OTHER']),
  reference,
  seasonId: optionalId,
  productionId: optionalId,
  date: dateKey,
}).strict()

export const ticketTypeSchema = z.object({
  showDateId: financeIdSchema,
  name: z.string().trim().min(2).max(80),
  price: z.number().int().safe().nonnegative().max(2_147_483_647),
  quantityAvailable: z.union([z.number().int().positive().safe().max(2_147_483_647), z.literal('')]),
}).strict()

export const ticketSaleSchema = z.object({
  ticketTypeId: financeIdSchema,
  quantity: z.number().int().positive().max(1000),
  buyerName: z.string().trim().max(160).default(''),
  method: z.enum(['MPESA', 'CASH', 'OTHER']),
  reference,
}).strict()

export const ticketRefundSchema = z.object({
  ticketSaleId: financeIdSchema,
  amount: positiveAmount,
  reason: z.string().trim().min(3).max(500),
}).strict()

export const guestEntrySchema = z.object({
  showDateId: financeIdSchema,
  ticketSaleId: optionalId,
  name: z.string().trim().min(2).max(160),
  note: z.string().trim().max(300).default(''),
}).strict()

export const reconciliationBatchSchema = z.object({
  method: z.enum(['MPESA', 'CASH', 'OTHER']),
  statementDate: dateKey,
  reference: z.string().trim().min(2).max(120),
}).strict()

export const statementEntrySchema = z.object({
  batchId: financeIdSchema,
  statementReference: z.string().trim().min(1).max(120),
  amount: positiveAmount,
  notes: z.string().trim().max(300).default(''),
}).strict()

export const financeReportSchema = z.object({
  seasonId: optionalId,
  productionId: optionalId,
}).strict()
