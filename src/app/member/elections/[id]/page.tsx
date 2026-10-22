import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { NominateForm, SecretBallotForm } from '@/components/elections/forms'
import { pagePermission } from '@/lib/page-access'
import { userIdSchema } from '@/lib/validation'
import { getMemberElection } from '@/modules/elections/read-service'

export default async function MemberElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pagePermission('elections:vote')
  if (!user.member) redirect('/forbidden')
  const parsedId = userIdSchema.safeParse((await params).id)
  if (!parsedId.success) notFound()
  const election = await getMemberElection(parsedId.data, user.member.id)
  if (!election) notFound()
  const eligible = election.eligibleVoters.length > 0
  const voted = election.voteReceipts.length > 0

  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/member/elections">Back to elections</Link>
    <header className="card space-y-3"><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Election · {election.status.replaceAll('_', ' ')}</p><h1>{election.title}</h1>{election.description && <p className="text-slate-600">{election.description}</p>}</header>
    {election.status === 'NOMINATIONS_OPEN' && <section className="card space-y-4">
      <h2>Offices and nominations</h2><p className="text-sm text-slate-600">Nominations are self-nominations and require committee review.</p>
      {election.offices.map((office) => {
        const ownNomination = office.myNominations[0]
        return <article className="space-y-2 rounded-lg border border-slate-200 p-4" key={office.id}>
          <h3>{office.title}</h3>
          {ownNomination
            ? <p className="text-sm text-slate-600">Your nomination is {ownNomination.status.toLowerCase()}.</p>
            : user.member?.status === 'ACTIVE' && <NominateForm electionId={election.id} officeId={office.id} />}
        </article>
      })}
    </section>}
    {election.status === 'VOTING_OPEN' && <section className="card space-y-4">
      <h2>Secret ballot</h2>
      {voted
        ? <p role="status" className="text-emerald-800">Your ballot receipt is recorded. Election staff can view only aggregate results after publication.</p>
        : !eligible
          ? <p className="text-slate-600">You are not on the frozen eligible-voter register for this election.</p>
          : <SecretBallotForm electionId={election.id} offices={election.offices} />}
    </section>}
    {election.status === 'RESULTS_PUBLISHED' && election.results && <section className="card space-y-4">
      <h2>Published results</h2>
      <p>Turnout: {election.results.turnout}/{election.results.eligibleVoterCount} ({election.results.turnoutPercent}%)</p>
      {election.results.offices.map((office) => <article className="space-y-2 rounded-lg border border-slate-200 p-4" key={office.officeId}>
        <h3>{office.title}</h3>
        <ul>{office.candidates.map((candidate) => <li key={candidate.nominationId}>{candidate.name}: {candidate.votes}</li>)}</ul>
        <p>Abstain: {office.abstentions} · None of the above: {office.noneOfTheAbove}</p>
        {office.noneOfTheAboveWins && <p>None of the above received more votes than any candidate; no candidate is elected.</p>}
        {office.noneOfTheAboveTie && <p>None of the above tied with the leading candidate; no candidate is elected.</p>}
        {office.candidateTie && !office.noneOfTheAboveWins && !office.noneOfTheAboveTie && <p>{office.tieRule === 'CO_WINNERS' ? `Co-winners: ${office.winners.map((winner) => winner.name).join(', ')}` : 'Tie: no winner under the published tie rule.'}</p>}
        {!office.tied && !office.noneOfTheAboveWins && office.winners.length > 0 && <p>Winner: {office.winners.map((winner) => winner.name).join(', ')}</p>}
        {!office.winners.length && !office.tied && !office.noneOfTheAboveWins && <p>No candidate votes; no winner.</p>}
      </article>)}
    </section>}
  </div>
}
