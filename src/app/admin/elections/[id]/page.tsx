import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ElectionTransitionForm, NominationReviewForm } from '@/components/elections/forms'
import { pagePermission } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { getAdminElection } from '@/modules/elections/read-service'
import { getPublishedResults } from '@/modules/elections/service'

export default async function AdminElectionPage({ params }: { params: Promise<{ id: string }> }) {
  await pagePermission('elections:manage')
  const parsedId = userIdSchema.safeParse((await params).id)
  if (!parsedId.success) notFound()
  const election = await getAdminElection(parsedId.data)
  if (!election) notFound()
  const results = election.status === 'RESULTS_PUBLISHED' ? await getPublishedResults(election.id) : null

  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/admin/elections">Back to elections</Link>
    <header className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-1 text-sm font-semibold uppercase tracking-widest text-emerald-700">Election</p><h1>{election.title}</h1></div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{election.status.replaceAll('_', ' ')}</span>
      </div>
      {election.description && <p className="text-slate-600">{election.description}</p>}
      {election.status !== 'DRAFT' && <p className="text-sm text-slate-600">Turnout: {election.turnoutCount}/{election.eligibleVoterCount} eligible voters</p>}
      <ElectionTransitionForm electionId={election.id} status={election.status} />
    </header>
    <section className="card space-y-4">
      <h2>Offices and nominations</h2>
      {election.offices.map((office) => <article className="space-y-3 rounded-lg border border-slate-200 p-4" key={office.id}>
        <div><h3>{office.title}</h3><p className="text-sm text-slate-600">Tie rule: {office.tieRule === 'CO_WINNERS' ? 'co-winners' : 'no winner'}</p></div>
        {office.nominations.length
          ? <ul className="space-y-3">{office.nominations.map((nomination) => <li className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3" key={nomination.id}>
            <div><p className="font-medium">{nomination.member.fullName}</p><p className="text-sm text-slate-600">Nomination: {nomination.status.toLowerCase()}</p></div>
            {election.status === 'NOMINATIONS_OPEN' && nomination.status === 'PENDING' && <NominationReviewForm electionId={election.id} nominationId={nomination.id} />}
          </li>)}</ul>
          : <p className="text-sm text-slate-600">No nominations yet.</p>}
      </article>)}
    </section>
    {results && <section className="card space-y-4">
      <h2>Published aggregate results</h2>
      <p>Turnout: {results.turnout}/{results.eligibleVoterCount} ({results.turnoutPercent}%)</p>
      {results.offices.map((office) => <article className="space-y-2 rounded-lg border border-slate-200 p-4" key={office.officeId}>
        <h3>{office.title}</h3>
        <ul className="space-y-1">{office.candidates.map((candidate) => <li key={candidate.nominationId}>{candidate.name}: {candidate.votes}</li>)}</ul>
        <p>Abstain: {office.abstentions} · None of the above: {office.noneOfTheAbove}</p>
        {office.noneOfTheAboveWins && <p role="status">None of the above received more votes than any candidate; no candidate is elected.</p>}
        {office.noneOfTheAboveTie && <p role="status">None of the above tied with the leading candidate; no candidate is elected.</p>}
        {office.candidateTie && !office.noneOfTheAboveWins && !office.noneOfTheAboveTie && <p role="status">{office.tieRule === 'CO_WINNERS' ? 'Candidates tied for the lead are co-winners.' : 'This office has no winner under its tie rule.'}</p>}
        {!office.tied && !office.noneOfTheAboveWins && office.winners.length > 0 && <p role="status">Winner: {office.winners.map((winner) => winner.name).join(', ')}</p>}
        {!office.winners.length && !office.tied && !office.noneOfTheAboveWins && <p role="status">No votes were cast for a candidate; no winner.</p>}
      </article>)}
    </section>}
  </div>
}
