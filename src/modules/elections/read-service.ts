import 'server-only'
import { electionsRepository } from './repository'
import { getPublishedResults } from './service'

export async function listAdminElections() {
  return electionsRepository.listAdminElections()
}

export async function getAdminElection(electionId: string) {
  const election = await electionsRepository.findAdminElection(electionId)
  return election
    ? { ...election, turnoutCount: await electionsRepository.countVotersForElection(election.id) }
    : null
}

export async function listMemberElections(memberId: string) {
  const elections = await electionsRepository.listMemberElections(memberId)
  return Promise.all(elections.map(async (election) => ({
    ...election,
    results: election.status === 'RESULTS_PUBLISHED' ? await getPublishedResults(election.id) : null,
  })))
}

export async function getMemberElection(electionId: string, memberId: string) {
  const elections = await electionsRepository.listMemberElections(memberId)
  const election = elections.find((item) => item.id === electionId)
  if (!election) return null
  return {
    ...election,
    results: election.status === 'RESULTS_PUBLISHED' ? await getPublishedResults(election.id) : null,
  }
}
