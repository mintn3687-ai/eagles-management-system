import 'server-only'
import { MemberError } from '@/lib/members/errors'
import { previewCsv } from '@/lib/members/csv'
import { addMembersToCurrentSeason } from '@/modules/seasons/service'
import { memberImportRepository } from './import-repository'

async function previewInTransaction(source: string, tx: Parameters<typeof memberImportRepository.findExistingContacts>[0]) {
  const rows = previewCsv(source)
  const valid = rows.filter((row) => !row.errors.length)
  const [members, users] = await memberImportRepository.findExistingContacts(
    tx,
    valid.map((row) => row.values.phone),
    valid.map((row) => row.values.email),
  )
  const usedPhones = new Set(members.map((member) => member.phone))
  const usedEmails = new Set([...members, ...users].map((record) => record.email))
  for (const row of rows) {
    if (usedPhones.has(row.values.phone)) row.errors.push('Phone already belongs to a member.')
    if (usedEmails.has(row.values.email)) row.errors.push('Email already belongs to a member or login account.')
  }
  return rows
}

export async function previewMemberImport(source: string) {
  return memberImportRepository.transaction((tx) => previewInTransaction(source, tx))
}

export async function importMembers(source: string, actorId: string) {
  return memberImportRepository.transaction(async (tx) => {
    const rows = await previewInTransaction(source, tx)
    if (rows.some((row) => row.errors.length)) {
      throw new MemberError('Nothing was imported. Fix the errors and duplicates, then preview again.')
    }
    const users = await memberImportRepository.createUsers(tx, rows.map(({ values }) => values))
    const userIds = new Map(users.map((user) => [user.email, user.id]))
    const importedAt = new Date()
    const members = await memberImportRepository.createMembers(
      tx,
      rows.map(({ values }) => values),
      userIds,
      importedAt,
    )
    await addMembersToCurrentSeason(tx, members.map((member) => ({
      memberId: member.id,
      status: 'PENDING_REGISTRATION',
    })))
    await memberImportRepository.insertInitialStatusHistory(tx, members.map(({ id }) => id), importedAt)
    const audit = await memberImportRepository.createImportAudit(tx, actorId, members.length)
    await memberImportRepository.createMemberAudits(tx, actorId, members.map(({ id }) => id), audit.id)
    return members.length
  })
}
