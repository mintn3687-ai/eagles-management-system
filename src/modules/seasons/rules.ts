import type { SeasonMembershipStatus } from '@prisma/client'

export type RolloverMember = {
  memberId: string
  status: SeasonMembershipStatus
  roleInSeason: string
  userRole: 'MEMBER' | 'COMMITTEE' | 'SUPER_ADMIN' | null
}

export class SeasonRuleError extends Error {}

export function buildMembershipCarryForward(
  members: readonly RolloverMember[],
  selectedIds: readonly string[],
  changedStatus: 'INACTIVE' | 'ALUMNI',
) {
  const selected = new Set(selectedIds)
  if (selected.size !== selectedIds.length) throw new SeasonRuleError('A member was selected more than once.')

  const byId = new Map(members.map((member) => [member.memberId, member]))
  if (selectedIds.some((id) => !byId.has(id) || byId.get(id)?.status !== 'ACTIVE')) {
    throw new SeasonRuleError('One or more selected members are no longer active in the current season. Refresh the list and try again.')
  }
  if (selectedIds.some((id) => byId.get(id)?.userRole === 'SUPER_ADMIN')) {
    throw new SeasonRuleError('Transfer Super Admin access before changing that member’s season status.')
  }

  const memberships = members.map((member) => ({
    memberId: member.memberId,
    status: selected.has(member.memberId) ? changedStatus : member.status,
    roleInSeason: member.roleInSeason,
    feesOwed: 0,
    feesPaid: 0,
  }))
  return {
    memberships,
    changedMembers: members.filter((member) => selected.has(member.memberId)),
  }
}

export function suggestedNextSeasonDates(endDate: Date) {
  const start = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
  const startParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(start)
  const part = (type: string) => startParts.find((item) => item.type === type)!.value
  const startDate = `${part('year')}-${part('month')}-${part('day')}`
  const nextYear = Number(part('year')) + 1
  const nextYearAnniversary = Date.UTC(nextYear, Number(part('month')) - 1, Number(part('day')))
  const lastDay = new Date(nextYearAnniversary - 24 * 60 * 60 * 1000)
  const endDateKey = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`
  return { startDate, endDate: endDateKey }
}
