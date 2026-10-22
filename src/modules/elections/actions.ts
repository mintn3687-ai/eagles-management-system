'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  ballotSchema,
  electionCreateSchema,
  electionIdSchema,
  nominationReviewSchema,
  nominationSchema,
} from './schema'
import {
  closeVoting,
  createElection,
  ElectionServiceError,
  openNominations,
  openVoting,
  publishElectionResults,
  reviewNomination,
  submitBallot,
  submitNomination,
} from './service'

export type ElectionActionState = { success?: boolean; message?: string; error?: string }

const electionTransitionSchema = z.object({
  electionId: electionIdSchema.shape.electionId,
  status: z.enum(['NOMINATIONS_OPEN', 'VOTING_OPEN', 'CLOSED', 'RESULTS_PUBLISHED']),
}).strict()

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function failed(error: unknown): ElectionActionState {
  if (error instanceof ElectionServiceError || error instanceof AccessError) return { error: error.message }
  return { error: 'Could not save the election change. Please try again.' }
}

function refresh(electionId?: string) {
  revalidatePath('/admin/elections')
  revalidatePath('/member/elections')
  if (electionId) {
    revalidatePath(`/admin/elections/${electionId}`)
    revalidatePath(`/member/elections/${electionId}`)
  }
}

export async function createElectionAction(_state: ElectionActionState, form: FormData): Promise<ElectionActionState> {
  try {
    const actor = await requirePermission('elections:manage')
    const officeTitles = form.getAll('officeTitle')
    const officeTieRules = form.getAll('officeTieRule')
    const parsed = electionCreateSchema.safeParse({
      title: text(form, 'title'),
      description: text(form, 'description'),
      requireActiveMember: form.get('requireActiveMember') === 'on',
      requireFeesCurrent: form.get('requireFeesCurrent') === 'on',
      offices: officeTitles.flatMap((value, index) => {
        const title = typeof value === 'string' ? value.trim() : ''
        const tieRule = officeTieRules[index]
        return title && typeof tieRule === 'string' ? [{ title, tieRule }] : []
      }),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the election details.' }
    const election = await createElection(parsed.data, actor.id)
    refresh(election.id)
    return { success: true, message: `Election draft “${election.title}” created.` }
  } catch (error) {
    return failed(error)
  }
}

export async function transitionElectionAction(_state: ElectionActionState, form: FormData): Promise<ElectionActionState> {
  try {
    const actor = await requirePermission('elections:manage')
    const parsed = electionTransitionSchema.safeParse({
      electionId: text(form, 'electionId'),
      status: text(form, 'status'),
    })
    if (!parsed.success) return { error: 'Choose a valid election transition.' }
    if (parsed.data.status === 'NOMINATIONS_OPEN') await openNominations(parsed.data.electionId, actor.id)
    else if (parsed.data.status === 'VOTING_OPEN') await openVoting(parsed.data.electionId, actor.id)
    else if (parsed.data.status === 'CLOSED') await closeVoting(parsed.data.electionId, actor.id)
    else if (parsed.data.status === 'RESULTS_PUBLISHED') await publishElectionResults(parsed.data.electionId, actor.id)
    else return { error: 'Choose a valid election transition.' }
    refresh(parsed.data.electionId)
    return { success: true, message: 'Election lifecycle updated.' }
  } catch (error) {
    return failed(error)
  }
}

export async function nominateAction(_state: ElectionActionState, form: FormData): Promise<ElectionActionState> {
  try {
    const actor = await requirePermission('elections:vote')
    const parsed = nominationSchema.safeParse({ electionId: text(form, 'electionId'), officeId: text(form, 'officeId') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose an office.' }
    if (!actor.member) return { error: 'A linked member account is required to nominate.' }
    await submitNomination(parsed.data.electionId, parsed.data.officeId, actor.member.id, actor.id)
    refresh(parsed.data.electionId)
    return { success: true, message: 'Your nomination was submitted for review.' }
  } catch (error) {
    return failed(error)
  }
}

export async function reviewNominationAction(_state: ElectionActionState, form: FormData): Promise<ElectionActionState> {
  try {
    const actor = await requirePermission('elections:manage')
    const parsed = nominationReviewSchema.safeParse({
      electionId: text(form, 'electionId'),
      nominationId: text(form, 'nominationId'),
      status: text(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a nomination decision.' }
    await reviewNomination(parsed.data.electionId, parsed.data.nominationId, parsed.data.status, actor.id)
    refresh(parsed.data.electionId)
    return { success: true, message: 'Nomination review saved.' }
  } catch (error) {
    return failed(error)
  }
}

export async function submitBallotAction(_state: ElectionActionState, form: FormData): Promise<ElectionActionState> {
  try {
    const actor = await requirePermission('elections:vote')
    if (!actor.member) return { error: 'A linked member account is required to vote.' }
    let choices: unknown
    try {
      choices = JSON.parse(text(form, 'choices'))
    } catch {
      return { error: 'The ballot is invalid. Please select one choice for each office.' }
    }
    const parsed = ballotSchema.safeParse({ electionId: text(form, 'electionId'), choices })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your ballot choices.' }
    await submitBallot(parsed.data, actor.member.id)
    refresh(parsed.data.electionId)
    return { success: true, message: 'Your ballot was submitted. Election staff can view only aggregate results after publication.' }
  } catch (error) {
    return failed(error)
  }
}
