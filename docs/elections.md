# Elections and Secret-Ballot Voting

## Access and routes

- `/admin/elections` — Committee and Super Admin create and manage elections.
- `/admin/elections/[id]` — Committee and Super Admin review nominations, advance lifecycle states, and approve/publish results.
- `/member/elections` — signed-in members view current elections and published results.
- `/member/elections/[id]` — active members nominate themselves, eligible voters submit one ballot, and members view published aggregates.

Actions check the central `elections:manage` or `elections:vote` permission. Existing consent, account status, and session checks still apply. Staff accounts without a linked member record cannot nominate or vote.

## Data model

- `Election` stores lifecycle state, eligibility configuration, frozen voter count and digest, transition timestamps, and results approver.
- `Office` stores an election position and its tie rule.
- `Nomination` links a member to an office. Members nominate themselves during the nominations window; Committee reviews each pending nomination.
- `EligibleVoter` is the frozen voter snapshot.
- `VoteReceipt` records the election, office, and member who voted for that office. A unique election/member/office constraint prevents a second vote for the same office. It has no ballot identifier or relation to a ballot.
- `Ballot` belongs only to an election. Its `BallotChoice` rows refer to offices and, for candidate selections, approved nominations. No ballot row refers to a member or receipt.

All election tables are added by migration `202610230002_elections_secret_ballot`; existing member, season, meeting, and payment data is not changed. Foreign keys use restrictive deletes and voting uniqueness is backed by the database: one receipt per member/election/office and one choice per ballot/office. The service requires a complete ballot containing exactly one office choice per election office and submits the receipts, ballot, and choices in one transaction. There is no audit event for an individual ballot or choice.

Election timestamps use UTC instants. User-facing dates use the app's existing Africa/Nairobi convention.

## Lifecycle and rules

1. Committee creates a draft with one or more offices, an active-season requirement, an optional up-to-date-fees requirement, and a tie rule for every office.
2. Committee opens nominations. Only a currently active member in the current season may nominate themselves once per office. Committee approves or rejects pending nominations. Voting cannot open until every office has an approved candidate and no nomination remains pending.
3. When Committee opens voting, current-season membership records are evaluated using the election's configured requirements and frozen in `EligibleVoter`. The service stores a sorted snapshot digest and the eligible count. Later membership or fee changes do not alter that snapshot.
4. A frozen eligible voter submits one choice for every office: an approved candidate, abstain, or none of the above. The service and a unique `VoteReceipt` constraint reject a second submission. The election row is locked during voting and lifecycle changes so close cannot race with a ballot submission.
5. Committee closes voting. Results cannot be read from the application before this transition.
6. A Committee member or Super Admin approves and publishes aggregate turnout and per-office totals. If that actor is a candidate in the election, publication is rejected. The tie rule determines whether tied highest candidates are co-winners or there is no winner. If “none of the above” wins or ties the leading candidate, no candidate is elected.
7. Application administrators can view aggregate published results but cannot view individual ballot selections or connect them to the receipt register.

## Manual verification

1. Sign in as Committee or Super Admin and open `/admin/elections`.
2. Create an election with multiple offices and choose eligibility and tie rules. Verify a draft appears.
3. Open nominations. Sign in as an active member, nominate themselves, and verify another member cannot nominate the same account twice for the same office.
4. Review each pending nomination in the admin election detail. Verify voting cannot open if any office lacks an approved candidate or nominations remain pending.
5. Open voting and verify voter count is frozen. Submit a ballot as an eligible member; verify the receipt appears as voted to that member but the UI never displays their choices. Try a second submission and a non-eligible account.
6. Verify voting submission is rejected before voting opens and after it is closed. Close the election and verify results are still hidden until publication.
7. Try to publish as a candidate and verify rejection. Publish as a non-candidate administrator; verify turnout, candidate totals, abstain/none totals, and tie handling.
8. Review `/admin/audit`; confirm lifecycle and nomination decisions appear but no individual ballot choice or voter/choice association is logged.

## Limitations

- Nominations are self-submissions only; there is no proxy or committee-created nomination workflow.
- Each ballot covers all offices as one submission. There is no partial ballot, revoting, runoff, or tie-break election flow; tie rules are co-winners or no winner.
- This phase does not provide automated scheduling or a background close timer; authorized Committee users explicitly open and close lifecycle stages.
- Secret-ballot separation is enforced at the application authorization and relational-data layers: there is no receipt-to-ballot key, and election staff receive only aggregate results. Receipts and anonymous choices are written in one transaction; operators with unrestricted database or transaction-log access may infer timing correlation. Stronger anonymity against infrastructure operators would require a ballot-mixing or cryptographic voting design.
- Confirm local legal requirements for elections and member data handling.
