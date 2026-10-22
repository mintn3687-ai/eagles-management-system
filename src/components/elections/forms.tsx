'use client'

import { useState, useActionState } from 'react'
import { SubmitButton } from '@/components/submit-button'
import {
  createElectionAction,
  nominateAction,
  reviewNominationAction,
  submitBallotAction,
  transitionElectionAction,
} from '@/modules/elections/actions'
import type { ElectionActionState } from '@/modules/elections/actions'

function Notice({ state }: { state: ElectionActionState }) {
  return state.error
    ? <p role="alert" className="error">{state.error}</p>
    : state.success
      ? <p role="status" className="text-sm text-emerald-800">{state.message}</p>
      : null
}

export function ElectionCreateForm() {
  const [state, action] = useActionState(createElectionAction, {})
  const [officeCount, setOfficeCount] = useState(2)
  return <form action={action} className="card space-y-4">
    <h2>Create an election draft</h2>
    <div><label className="label" htmlFor="electionTitle">Election title</label><input className="input" id="electionTitle" name="title" maxLength={120} required /></div>
    <div><label className="label" htmlFor="electionDescription">Description</label><textarea className="input" id="electionDescription" name="description" maxLength={2000} rows={3} /></div>
    <fieldset className="space-y-3">
      <legend className="label">Offices (add at least one)</legend>
      {Array.from({ length: officeCount }, (_, index) => <div className="grid gap-2 sm:grid-cols-2" key={index}>
        <div><label className="label" htmlFor={`electionOffice${index}`}>Office {index + 1}</label>
          <input className="input" id={`electionOffice${index}`} name="officeTitle" maxLength={80} /></div>
        <div><label className="label" htmlFor={`electionTieRule${index}`}>Tie handling</label>
          <select className="input" id={`electionTieRule${index}`} name="officeTieRule" defaultValue="NO_WINNER">
            <option value="NO_WINNER">No winner in a tie</option>
            <option value="CO_WINNERS">Declare co-winners</option>
          </select></div>
      </div>)}
      {officeCount < 12 && <button className="btn-secondary" type="button" onClick={() => setOfficeCount((count) => Math.min(12, count + 1))}>Add another office</button>}
    </fieldset>
    <label className="flex min-h-11 items-center gap-3"><input className="h-5 w-5 accent-emerald-800" type="checkbox" name="requireActiveMember" defaultChecked /><span>Require active membership in current season</span></label>
    <label className="flex min-h-11 items-center gap-3"><input className="h-5 w-5 accent-emerald-800" type="checkbox" name="requireFeesCurrent" /><span>Require season fees to be up to date</span></label>
    <p className="text-sm text-slate-600">Eligibility is frozen when voting opens. Secret ballots are stored separately from voter receipts.</p>
    <Notice state={state} />
    <SubmitButton>Create draft</SubmitButton>
  </form>
}

export function ElectionTransitionForm({ electionId, status }: { electionId: string; status: string }) {
  const [state, action] = useActionState(transitionElectionAction, {})
  const next = {
    DRAFT: ['NOMINATIONS_OPEN', 'Open nominations'],
    NOMINATIONS_OPEN: ['VOTING_OPEN', 'Freeze voters and open voting'],
    VOTING_OPEN: ['CLOSED', 'Close voting'],
    CLOSED: ['RESULTS_PUBLISHED', 'Approve and publish results'],
  }[status]
  if (!next) return null
  return <form action={action} className="space-y-3">
    <input type="hidden" name="electionId" value={electionId} />
    <input type="hidden" name="status" value={next[0]} />
    {status === 'CLOSED' && <p className="text-sm text-slate-600">This approval publishes aggregate results. A candidate cannot approve their own election results.</p>}
    <Notice state={state} />
    <SubmitButton>{next[1]}</SubmitButton>
  </form>
}

export function NominationReviewForm({ electionId, nominationId }: { electionId: string; nominationId: string }) {
  const [state, action] = useActionState(reviewNominationAction, {})
  return <form action={action} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="electionId" value={electionId} />
    <input type="hidden" name="nominationId" value={nominationId} />
    <button className="btn-secondary" name="status" value="APPROVED">Approve</button>
    <button className="btn-secondary" name="status" value="REJECTED">Reject</button>
    <Notice state={state} />
  </form>
}

export function NominateForm({ electionId, officeId }: { electionId: string; officeId: string }) {
  const [state, action] = useActionState(nominateAction, {})
  return <form action={action} className="space-y-2">
    <input type="hidden" name="electionId" value={electionId} />
    <input type="hidden" name="officeId" value={officeId} />
    <SubmitButton>Nominate myself</SubmitButton>
    <Notice state={state} />
  </form>
}

type OfficeChoice = {
  officeId: string
  choiceType: 'CANDIDATE' | 'ABSTAIN' | 'NONE_OF_ABOVE'
  nominationId?: string
}

export function SecretBallotForm({ electionId, offices }: {
  electionId: string
  offices: Array<{ id: string; title: string; nominations: Array<{ id: string; member: { fullName: string } }> }>
}) {
  const [state, action] = useActionState(submitBallotAction, {})
  const [choices, setChoices] = useState<Record<string, OfficeChoice>>({})
  const serialized = JSON.stringify(Object.values(choices))
  function setChoice(officeId: string, choiceType: OfficeChoice['choiceType'], nominationId?: string) {
    setChoices((previous) => ({ ...previous, [officeId]: { officeId, choiceType, ...(nominationId ? { nominationId } : {}) } }))
  }
  return <form action={action} className="space-y-4">
    <input type="hidden" name="electionId" value={electionId} />
    <input type="hidden" name="choices" value={serialized} />
    {offices.map((office) => <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4" key={office.id}>
      <legend className="px-1 font-semibold">{office.title}</legend>
      {office.nominations.map((nomination) => <label className="flex min-h-11 items-center gap-3" key={nomination.id}>
        <input required={!choices[office.id]} className="h-5 w-5 accent-emerald-800" type="radio" name={`office-${office.id}`} onChange={() => setChoice(office.id, 'CANDIDATE', nomination.id)} />
        <span>{nomination.member.fullName}</span>
      </label>)}
      <label className="flex min-h-11 items-center gap-3"><input required={!choices[office.id]} className="h-5 w-5 accent-emerald-800" type="radio" name={`office-${office.id}`} onChange={() => setChoice(office.id, 'ABSTAIN')} /><span>Abstain</span></label>
      <label className="flex min-h-11 items-center gap-3"><input required={!choices[office.id]} className="h-5 w-5 accent-emerald-800" type="radio" name={`office-${office.id}`} onChange={() => setChoice(office.id, 'NONE_OF_ABOVE')} /><span>None of the above</span></label>
    </fieldset>)}
    <p className="text-sm text-slate-600">Your receipt records that you voted but has no link to these choices. Choices cannot be changed after submission.</p>
    <Notice state={state} />
    <SubmitButton>Submit secret ballot</SubmitButton>
  </form>
}
