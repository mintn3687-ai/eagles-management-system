import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AccessError } from '../permissions'

export class MemberError extends Error {}

export function logUnexpectedMemberError(operation: string, error: unknown) {
  if (error instanceof MemberError || error instanceof AccessError || error instanceof ZodError) return
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return

  const details: Record<string, string> = {
    operation,
    name: error instanceof Error ? error.name : typeof error,
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    details.code = error.code
    const target = error.meta?.target
    if (typeof target === 'string') details.target = target
    else if (Array.isArray(target)) details.target = target.map(String).join(', ')
  } else if (error instanceof Error) {
    details.message = error instanceof Prisma.PrismaClientUnknownRequestError
      ? 'Database rejected the operation; detailed error omitted to avoid logging submitted member data.'
      : error.name
  }
  console.error('Unexpected member action failure', details)
}

export function memberErrorMessage(error: unknown): string {
  if (error instanceof MemberError || error instanceof AccessError) return error.message
  if (error instanceof ZodError) return error.issues[0].message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = String(error.meta?.target ?? '')
    return target.includes('phone') ? 'That phone number already belongs to a member.' : 'That email address already belongs to a member or login account.'
  }
  return 'Could not save the change. Please try again.'
}
