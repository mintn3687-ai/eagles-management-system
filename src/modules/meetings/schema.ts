import { z } from 'zod'
import { userIdSchema } from '@/lib/validation'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')

const integer = (minimum: number, maximum: number) => z.preprocess(
  (value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(minimum).max(maximum),
)

export const meetingCreateSchema = z.object({
  title: z.string().trim().min(3, 'Enter a meeting title.').max(120),
  meetingDate: dateKey,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid start time.'),
  venue: z.string().trim().min(2, 'Enter a venue.').max(160),
  quorumPercent: integer(1, 100),
}).strict()

export const meetingIdSchema = z.object({ meetingId: userIdSchema }).strict()
export const agendaItemSchema = z.object({
  meetingId: userIdSchema,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).default(''),
}).strict()
export const attendanceUpdateSchema = z.object({
  meetingId: userIdSchema,
  presentMemberIds: z.array(userIdSchema).max(1000),
}).strict().refine((value) => new Set(value.presentMemberIds).size === value.presentMemberIds.length, {
  message: 'A member was submitted more than once.',
  path: ['presentMemberIds'],
})
export const meetingStatusSchema = z.object({
  meetingId: userIdSchema,
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
}).strict()
export const minutesSchema = z.object({
  meetingId: userIdSchema,
  minutes: z.string().trim().min(10, 'Add the meeting minutes before saving.').max(15000),
}).strict()
export const motionSchema = z.object({
  meetingId: userIdSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
}).strict()
export const motionDecisionSchema = z.object({
  meetingId: userIdSchema,
  motionId: userIdSchema,
  status: z.enum(['APPROVED', 'REJECTED', 'DEFERRED']),
  decisionNote: z.string().trim().max(1000).default(''),
}).strict()
export const actionItemSchema = z.object({
  meetingId: userIdSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  ownerMemberId: userIdSchema,
  dueDate: z.union([dateKey, z.literal('')]).default(''),
}).strict()
export const actionItemStatusSchema = z.object({
  meetingId: userIdSchema,
  actionItemId: userIdSchema,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
}).strict()

export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>
