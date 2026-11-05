import 'server-only'
import { memberDetailsRepository } from './repository'
import { createMemberRosterPdf } from './roster-pdf'

const PAGE_SIZE = 500

export async function createCompleteMemberRosterPdf() {
  const members: Awaited<ReturnType<typeof memberDetailsRepository.rosterPdfPage>> = []
  let cursor: string | undefined

  while (true) {
    const page = await memberDetailsRepository.rosterPdfPage(cursor, PAGE_SIZE)
    members.push(...page)
    if (page.length < PAGE_SIZE) break
    cursor = page.at(-1)!.id
  }

  return createMemberRosterPdf(members)
}
