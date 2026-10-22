import { z } from 'zod'
import { normalizeKenyanPhone } from './phone'
export { normalizeKenyanPhone } from './phone'
export const emailSchema = z.string().trim().max(254).email('Enter a valid email address.').toLowerCase()
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Use at most 72 bytes for your password.')
export const phoneSchema = z.string().max(32).transform((value, ctx) => {
  const phone = normalizeKenyanPhone(value)
  if (!phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a Kenyan mobile number such as 0712345678.' })
    return z.NEVER
  }
  return phone
})
export const kesAmountSchema = z.number().int().min(0).max(2147483647)
export const userIdSchema = z.string().cuid()
