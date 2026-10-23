import 'server-only'
import { MemberError } from '@/lib/members/errors'
import { writeAuditLog } from '@/lib/audit'
import { addMembersToCurrentSeason, syncCurrentSeasonMemberStatus } from '@/modules/seasons/service'
import { hashInviteToken, newInviteToken } from '@/lib/auth/invites'
import { memberDetailsRepository } from './repository'
import type { MemberCreateInput, MemberDetailsInput, MemberStatusInput } from './schema'

export async function createMember(data: MemberCreateInput, actorId: string) {
  const token = newInviteToken()
  const member = await memberDetailsRepository.transaction(async (tx) => {
    if (await memberDetailsRepository.hasEmailConflict(tx, data.email)) {
      throw new MemberError('That email address already belongs to a member or login account.')
    }
    const user = await memberDetailsRepository.createUser(tx, data.email, data.fullName)
    const { existingMember, ...details } = data
    const status = existingMember ? 'ACTIVE' : 'PENDING_REGISTRATION'
    const joinedAt = new Date()
    const created = await memberDetailsRepository.createMember(tx, {
      ...details, userId: user.id, status, joinedAt,
    })
    await addMembersToCurrentSeason(tx, [{ memberId: created.id, status }])
    await memberDetailsRepository.insertStatusHistory(tx, created.id, status, joinedAt)
    await memberDetailsRepository.createInvite(tx, {
      userId: user.id,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    })
    await writeAuditLog(tx, {
      actorId, action: 'MEMBER_CREATED', entity: 'Member', entityId: created.id,
      details: { existingMember },
    })
    await writeAuditLog(tx, {
      actorId, action: 'INVITE_CREATED', entity: 'User', entityId: user.id, details: {},
    })
    return created
  })
  return { memberId: member.id, name: member.fullName, phone: member.phone, invitePath: `/invite/${token}` }
}

export async function editMember(memberId: string, data: MemberDetailsInput, actorId: string) {
  await memberDetailsRepository.transaction(async (tx) => {
    await memberDetailsRepository.lockMember(tx, memberId)
    const member = await memberDetailsRepository.findMemberForEdit(tx, memberId)
    if (!member) throw new MemberError('Member not found.')
    if (await memberDetailsRepository.hasEmailConflict(tx, data.email, memberId, member.userId)) {
      throw new MemberError('That email address already belongs to a member or login account.')
    }
    await memberDetailsRepository.updateMember(tx, memberId, data)
    if (member.userId) {
      await memberDetailsRepository.updateUser(tx, member.userId, { email: data.email, name: data.fullName })
      if (member.email !== data.email) {
        await memberDetailsRepository.invalidateUnusedInvites(tx, member.userId, new Date())
      }
    }
    const fields = (Object.keys(data) as (keyof typeof data)[]).filter((key) => data[key] !== member[key])
    await writeAuditLog(tx, {
      actorId, action: 'MEMBER_EDITED', entity: 'Member', entityId: memberId, details: { fields },
    })
  })
}

export async function changeMemberStatus(
  memberId: string,
  data: MemberStatusInput,
  actorId: string,
) {
  await memberDetailsRepository.transaction(async (tx) => {
    await memberDetailsRepository.lockMember(tx, memberId)
    const member = await memberDetailsRepository.findMemberForStatus(tx, memberId)
    if (!member) throw new MemberError('Member not found.')
    const user = member.userId ? await memberDetailsRepository.memberUserRole(tx, member.userId) : null
    if (user?.role === 'SUPER_ADMIN' && ['INACTIVE', 'SUSPENDED'].includes(data.status)) {
      throw new MemberError('Change this user’s role before restricting their membership.')
    }
    const effectiveAt = new Date()
    await memberDetailsRepository.updateMember(tx, memberId, { status: data.status })
    await syncCurrentSeasonMemberStatus(tx, memberId, data.status)
    await memberDetailsRepository.recordStatusChange(tx, memberId, member.status, data.status, effectiveAt)
    await writeAuditLog(tx, {
      actorId, action: 'MEMBER_STATUS_CHANGED', entity: 'Member', entityId: memberId,
      details: { from: member.status, to: data.status, reason: data.reason },
    })
  })
}

export async function changeUserRole(memberId: string, role: 'MEMBER' | 'COMMITTEE', actorId: string) {
  await memberDetailsRepository.transaction(async (tx) => {
    const member = await memberDetailsRepository.findMemberLogin(tx, memberId)
    if (!member?.userId) throw new MemberError('This member has no linked login account.')
    if (member.userId === actorId) throw new MemberError('Ask another Super Admin to change your role.')
    await memberDetailsRepository.lockUser(tx, member.userId)
    const user = await memberDetailsRepository.userRole(tx, member.userId)
    if (!user) throw new MemberError('Login account not found.')
    if (user.role === 'SUPER_ADMIN') throw new MemberError('Transfer Super Admin access from the team page.')
    await memberDetailsRepository.updateRole(tx, member.userId, role)
    await writeAuditLog(tx, {
      actorId, action: 'USER_ROLE_CHANGED', entity: 'User', entityId: member.userId,
      details: { from: user.role, to: role },
    })
  })
}
