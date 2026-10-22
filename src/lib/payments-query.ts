import { Prisma } from '@prisma/client'
import { parseNairobiDate } from '@/lib/dates'
import type { paymentListSchema } from '@/lib/validation/fees'
import { z } from 'zod'

export type PaymentFilters = z.infer<typeof paymentListSchema>

export function paymentWhere(filters: PaymentFilters): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {}
  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.method) where.method = filters.method
  if (filters.member) where.memberId = filters.member
  if (filters.from || filters.to) {
    where.paidAt = {
      ...(filters.from ? { gte: parseNairobiDate(filters.from) } : {}),
      ...(filters.to ? { lt: new Date(parseNairobiDate(filters.to).getTime() + 24 * 60 * 60 * 1000) } : {}),
    }
  }
  return where
}
