import { Prisma } from '@prisma/client'

export class AbsenceError extends Error {}

export function absenceErrorMessage(error: unknown): string {
  if (error instanceof AbsenceError) return error.message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return 'Record not found.'
  return 'Could not save the change. Please try again.'
}
