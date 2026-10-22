import { z } from 'zod'
import { userIdSchema } from '@/lib/validation'

const electionOfficeSchema = z.object({
  title: z.string().trim().min(2).max(80),
  tieRule: z.enum(['CO_WINNERS', 'NO_WINNER']),
}).strict()

export const electionCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(''),
  requireActiveMember: z.boolean(),
  requireFeesCurrent: z.boolean(),
  offices: z.array(electionOfficeSchema).min(1).max(12),
}).strict().refine((value) => {
  const titles = value.offices.map((office) => office.title.toLocaleLowerCase())
  return new Set(titles).size === titles.length
}, { message: 'Office titles must be unique.' })

export const electionIdSchema = z.object({ electionId: userIdSchema }).strict()
export const nominationSchema = z.object({
  electionId: userIdSchema,
  officeId: userIdSchema,
}).strict()
export const nominationReviewSchema = z.object({
  electionId: userIdSchema,
  nominationId: userIdSchema,
  status: z.enum(['APPROVED', 'REJECTED']),
}).strict()
export const ballotSchema = z.object({
  electionId: userIdSchema,
  choices: z.array(z.object({
    officeId: userIdSchema,
    choiceType: z.enum(['CANDIDATE', 'ABSTAIN', 'NONE_OF_ABOVE']),
    nominationId: userIdSchema.optional(),
  }).strict()).min(1).max(12),
}).strict().refine((ballot) => {
  const officeIds = ballot.choices.map((choice) => choice.officeId)
  return new Set(officeIds).size === officeIds.length
    && ballot.choices.every((choice) => choice.choiceType === 'CANDIDATE' ? Boolean(choice.nominationId) : !choice.nominationId)
}, { message: 'Select one valid choice for every office.' })

export type ElectionCreateInput = z.infer<typeof electionCreateSchema>
export type BallotInput = z.infer<typeof ballotSchema>
