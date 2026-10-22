import 'server-only'
import { parseNairobiDate } from '@/lib/dates'
import { writeAuditLog } from '@/lib/audit'
import { createFrozenSnapshot } from '@/lib/frozen-snapshot'
import { seasonsRepository } from './repository'
import type { SeasonCreateInput } from './schema'
import { buildMembershipCarryForward, SeasonRuleError } from './rules'

export class SeasonServiceError extends Error {}

export async function addMembersToCurrentSeason(
  tx: Parameters<typeof seasonsRepository.findCurrentInTransaction>[0],
  members: Array<{ memberId: string; status: 'PENDING_REGISTRATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ALUMNI' }>,
) {
  const season = await seasonsRepository.findCurrentInTransaction(tx)
  if (!season || members.length === 0) return
  await seasonsRepository.createMembershipsForCurrentSeason(tx, members.map((member) => ({
    seasonId: season.id,
    memberId: member.memberId,
    status: member.status,
    feesOwed: 0,
    feesPaid: 0,
    roleInSeason: 'MEMBER',
  })))
}

export async function syncCurrentSeasonMemberStatus(
  tx: Parameters<typeof seasonsRepository.findCurrentInTransaction>[0],
  memberId: string,
  status: 'PENDING_REGISTRATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ALUMNI',
) {
  const season = await seasonsRepository.findCurrentInTransaction(tx)
  if (season) await seasonsRepository.updateCurrentMembershipStatus(tx, { seasonId: season.id, memberId, status })
}

export async function getSeasonRolloverPage(page: number, pageSize: number) {
  const [currentSeason, total, members] = await Promise.all([
    seasonsRepository.findCurrent(),
    seasonsRepository.countCurrentActiveMembers(),
    seasonsRepository.listCurrentActiveMembers((page - 1) * pageSize, pageSize),
  ])
  return {
    currentSeason,
    total,
    members: members.map((row) => ({
      id: row.memberId,
      fullName: row.member.fullName,
      status: row.status,
      isSuperAdmin: row.member.user?.role === 'SUPER_ADMIN',
    })),
  }
}

export async function createNextSeason(input: SeasonCreateInput, actorId: string) {
  const startDate = parseNairobiDate(input.startDate)
  const endDate = parseNairobiDate(input.endDate)

  return seasonsRepository.transaction(async (tx) => {
    const current = await tx.season.findFirst({ where: { isCurrent: true } })
    if (!current) throw new SeasonServiceError('No current season is configured.')
    if (startDate <= current.endDate) {
      throw new SeasonServiceError('The next season must start after the current season ends.')
    }
    if (await seasonsRepository.findDateOverlaps(tx, startDate, endDate)) {
      throw new SeasonServiceError('Season dates cannot overlap an existing season.')
    }

    const source = await seasonsRepository.listCurrentMembershipsForRollover(tx)
    const plan = buildMembershipCarryForward(
      source.map((item) => ({
        memberId: item.memberId,
        status: item.status,
        roleInSeason: item.roleInSeason,
        userRole: item.member.user?.role ?? null,
      })),
      input.memberIds,
      input.status,
    )
    const snapshot = createFrozenSnapshot(plan.memberships.map((membership) => ({
      id: membership.memberId,
      status: membership.status,
      roleInSeason: membership.roleInSeason,
    })))

    await seasonsRepository.retireCurrentSeason(tx, current.id)
    const season = await seasonsRepository.createNextSeason(tx, {
      name: input.name,
      startDate,
      endDate,
      snapshotHash: snapshot.hash,
    })
    await seasonsRepository.createMemberships(tx, plan.memberships.map((membership) => ({
      seasonId: season.id,
      ...membership,
    })))

    const effectiveAt = new Date()
    for (const member of plan.changedMembers) {
      await seasonsRepository.updateMemberStatus(tx, member.memberId, input.status)
      await seasonsRepository.createStatusHistory(tx, member.memberId, input.status, effectiveAt)
      await writeAuditLog(tx, {
        actorId,
        action: 'SEASON_MEMBERSHIP_STATUS_CHANGED',
        entity: 'SeasonMembership',
        entityId: `${season.id}:${member.memberId}`,
        details: { from: member.status, to: input.status, seasonId: season.id },
      })
    }

    await writeAuditLog(tx, {
      actorId,
      action: 'SEASON_CREATED',
      entity: 'Season',
      entityId: season.id,
      details: {
        name: season.name,
        startDate: input.startDate,
        endDate: input.endDate,
        carriedMembers: snapshot.count,
        changedMembers: plan.changedMembers.length,
        membershipSnapshotHash: snapshot.hash,
      },
    })
    return { seasonId: season.id, memberCount: snapshot.count, changedCount: plan.changedMembers.length }
  }).catch((error: unknown) => {
    if (error instanceof SeasonRuleError) throw new SeasonServiceError(error.message)
    throw error
  })
}
