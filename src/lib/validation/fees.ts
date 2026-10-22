import { z } from 'zod'
import { userIdSchema } from '@/lib/validation'

export const feeTypeSchema = z.enum(['REGISTRATION', 'SUBSCRIPTION'] as const)
export const billingPeriodSchema = z.enum(['MONTHLY', 'TERM', 'YEAR'] as const)
export const paymentStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] as const)
export const paymentMethodSchema = z.enum(['MPESA', 'CASH', 'OTHER'] as const)
const manualPaymentMethodSchema = z.enum(['CASH', 'OTHER'] as const)
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Choose a valid date.')

export const feeSettingInputSchema = z.object({
  type: feeTypeSchema,
  amount: z.coerce.number().int().min(1, 'Fee amount should be at least KES 1.').max(1000000, 'Fee amount is too high.'),
  billingPeriod: z.union([billingPeriodSchema, z.literal('')]).optional().transform((value) => value === '' ? null : value ?? null),
  reason: z.string().trim().min(3, 'Add a reason for the change.').max(500),
}).refine((data) => data.type !== 'SUBSCRIPTION' || Boolean(data.billingPeriod), {
  message: 'Choose a billing period for the subscription fee.',
  path: ['billingPeriod'],
})

export const manualPaymentSchema = z.object({
  memberId: userIdSchema,
  method: manualPaymentMethodSchema,
  reference: z.string().trim().min(3, 'Add a payment reference.').max(120),
  paymentDate: dateKeySchema,
  reason: z.string().trim().max(500).optional(),
})

export const waiveFeeSchema = z.object({
  memberId: userIdSchema,
  reason: z.string().trim().min(3, 'Add a reason for the waiver.').max(500),
})

export const paymentListSchema = z.object({
  type: z.union([feeTypeSchema, z.literal('')]).default(''),
  status: z.union([paymentStatusSchema, z.literal('')]).default(''),
  method: z.union([paymentMethodSchema, z.literal('')]).default(''),
  member: z.string().trim().max(80).default(''),
  from: z.union([dateKeySchema, z.literal('')]).default(''),
  to: z.union([dateKeySchema, z.literal('')]).default(''),
  page: z.coerce.number().int().min(1).max(200).default(1),
  memberPage: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
}).refine((data) => !data.from || !data.to || data.from <= data.to, {
  message: 'The end date must be on or after the start date.',
  path: ['to'],
})
