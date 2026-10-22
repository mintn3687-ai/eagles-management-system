import { z } from 'zod'
import { emailSchema, passwordSchema, userIdSchema } from './index'
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256).refine((v) => new TextEncoder().encode(v).length <= 72),
})
export const inviteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const inviteCreateSchema = z.object({ userId: userIdSchema }).strict()
export const acceptInviteSchema = z.object({
  token: inviteTokenSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Your passwords do not match.', path: ['confirmPassword'],
})
export const consentSchema = z.object({ consent: z.literal('on', { errorMap: () => ({ message: 'Tick the checkbox to continue.' }) }) })
