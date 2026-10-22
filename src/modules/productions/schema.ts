import { z } from 'zod'
import { userIdSchema } from '@/lib/validation'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

const optionalDateKey = z.union([dateKey, z.literal('')]).transform((value) => value || null)
const requiredText = (min: number, max: number, label: string) => z.string().trim().min(min, `Enter ${label}.`).max(max)

export const productionCreateSchema = z.object({
  title: requiredText(3, 120, 'a production title'),
  description: z.string().trim().max(2000).default(''),
  startDate: optionalDateKey,
  endDate: optionalDateKey,
}).strict().refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: 'End date must be on or after the start date.',
  path: ['endDate'],
})

export const productionIdSchema = z.object({ productionId: userIdSchema }).strict()
export const productionStatusSchema = z.object({
  productionId: userIdSchema,
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
}).strict()
export const scriptVersionSchema = z.object({
  productionId: userIdSchema,
  version: requiredText(1, 80, 'a version label'),
  usageRightsNotes: requiredText(3, 2000, 'usage-rights notes'),
  storageReference: z.string().trim().max(500).default(''),
}).strict()
export const roleSchema = z.object({
  productionId: userIdSchema,
  name: requiredText(2, 100, 'a role name'),
  description: z.string().trim().max(1000).default(''),
}).strict()
export const castingSchema = z.object({
  productionId: userIdSchema,
  roleId: userIdSchema,
  memberId: userIdSchema,
  type: z.enum(['CAST', 'UNDERSTUDY']),
}).strict()
export const crewSchema = z.object({
  productionId: userIdSchema,
  memberId: userIdSchema,
  assignment: requiredText(2, 100, 'a crew assignment'),
}).strict()
export const taskSchema = z.object({
  productionId: userIdSchema,
  title: requiredText(3, 160, 'a task title'),
  description: z.string().trim().max(2000).default(''),
  ownerMemberId: z.union([userIdSchema, z.literal('')]).default(''),
  deadline: optionalDateKey,
}).strict()
export const taskStatusSchema = z.object({
  productionId: userIdSchema,
  taskId: userIdSchema,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
}).strict()
export const showDateSchema = z.object({
  productionId: userIdSchema,
  date: dateKey,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid show time.'),
  venue: requiredText(2, 160, 'a show venue'),
}).strict()
export const callSheetSchema = z.object({
  productionId: userIdSchema,
  showDateId: userIdSchema,
  title: requiredText(3, 120, 'a call-sheet title'),
  callDate: dateKey,
  callTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid call time.'),
  notes: z.string().trim().max(2000).default(''),
  memberIds: z.array(userIdSchema).min(1).max(300),
}).strict().refine((value) => new Set(value.memberIds).size === value.memberIds.length, {
  message: 'A member was selected more than once.',
})
export const assetSchema = z.object({
  productionId: z.union([userIdSchema, z.literal('')]).default(''),
  name: requiredText(2, 120, 'an asset name'),
  category: z.enum(['PROP', 'COSTUME', 'EQUIPMENT', 'OTHER']),
  condition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
}).strict()
export const assetMovementSchema = z.object({
  assetId: userIdSchema,
  memberId: z.union([userIdSchema, z.literal('')]).default(''),
}).strict()
export const postShowNoteSchema = z.object({
  productionId: userIdSchema,
  showDateId: z.union([userIdSchema, z.literal('')]).default(''),
  note: requiredText(5, 5000, 'a post-show note'),
}).strict()
export const rehearsalLinkSchema = z.object({
  productionId: z.union([userIdSchema, z.literal('')]).default(''),
  rehearsalId: userIdSchema,
}).strict()

export type ProductionCreateInput = z.infer<typeof productionCreateSchema>
export type AssetSchemaInput = z.infer<typeof assetSchema>
export type CallSheetInput = z.infer<typeof callSheetSchema>
