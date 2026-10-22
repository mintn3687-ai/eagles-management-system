import type { Prisma } from '@prisma/client'
import { normalizeKenyanPhone } from '../validation'
import type { MemberFilters } from '../validation/members'

export function memberWhere(filters: MemberFilters): Prisma.MemberWhereInput {
  const phone = normalizeKenyanPhone(filters.q) ?? filters.q.replace(/[\s()-]/g, '').replace(/^\+/, '')
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { OR: [
      { fullName: { contains: filters.q, mode: 'insensitive' as const } },
      { email: { contains: filters.q, mode: 'insensitive' as const } },
      { phone: { contains: phone || filters.q } },
    ] } : {}),
  }
}
export function memberOrder(filters: MemberFilters): Prisma.MemberOrderByWithRelationInput[] {
  return [filters.sort === 'joined' ? { joinedAt: filters.direction } : { fullName: filters.direction }, { id: 'asc' }]
}
export function memberQueryString(filters: MemberFilters, page = filters.page) {
  return new URLSearchParams({ q: filters.q, status: filters.status, sort: filters.sort, direction: filters.direction, page: String(page) }).toString()
}
