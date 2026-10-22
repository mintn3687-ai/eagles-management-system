import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AccessError } from '../permissions'

export class MemberError extends Error {}
export function memberErrorMessage(error: unknown): string {
  if (error instanceof MemberError || error instanceof AccessError) return error.message
  if (error instanceof ZodError) return error.issues[0].message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = String(error.meta?.target ?? '')
    return target.includes('phone') ? 'That phone number already belongs to a member.' : 'That email address already belongs to a member or login account.'
  }
  return 'Could not save the change. Please try again.'
}
