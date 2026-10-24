# Festival Planning

## Current phase

Phase 2 provides an admin-only festival register and festival details form. Phase 3 adds invitation tracking, configurable entry categories, competition entries, and submission deadlines. Phase 4 adds festival budget items and explicit links to existing finance entries. Committee members and super admins with the centralized festival and finance permissions can manage these records.

The selected approval rule for a later phase is that any committee member may approve a festival plan or budget, including their own submission. Approval workflows and approved amounts are not implemented yet.

## Database change

Phase 2 adds the `FestivalStatus` enum and `Festival` model. Phase 3 adds invitation and entry models. Phase 4 adds `FestivalBudgetType`, `FestivalBudgetItem`, and `FestivalFinanceLink`. Existing Prisma model definitions were not changed. IDs linking these feature records to festivals, productions, finance entries, and users are scalar IDs validated by the feature service because existing model relations are not being edited.

Migration file: `prisma/migrations/20261024090000_festival_planning/migration.sql`.
Phase 3 migration file: `prisma/migrations/20261024100000_festival_entries/migration.sql`.
Phase 4 migration file: `prisma/migrations/20261024110000_festival_budget_finance/migration.sql`.

No database migration was run. Preview may share Production data, so verify the target database is isolated and explicitly approve before deploying any migration to any database.

## How to use

1. Sign in with a Committee or Super Admin account.
2. Open **Festivals** in the admin navigation.
3. Create a festival record. Dates are optional until known.
4. Open the festival to update its details and planning status.
5. Record invitations and organizer response deadlines.
6. Add the categories/classes and default deadlines specified by the festival organizer. These values are user-configured rather than hardcoded.
7. Add each competition entry. Link an existing production if appropriate; otherwise enter a title for a standalone item. A per-entry deadline overrides the category default.
8. Update an invitation to accepted/declined, and move an entry through pending, preparing, submitted, then confirmed or rejected. Overdue status is calculated from the configured date while an invitation or entry is still awaiting action.
9. Add planned income and expense lines in KES. Budget lines are forecasts; they do not create ledger records.
10. Link an existing finance entry to a matching income/expense budget line. Each ledger entry can be linked to one item for its full amount. Removing the link only removes the association; it does not modify the finance entry. Every link and unlink is audited.

No additional environment variables or file-storage provider are required. Document attachments are not included in these phases.

## Safe verification

- Run `npx vitest run tests/festivals.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.
- Verify a Member cannot access `/admin/festivals`, while Committee and Super Admin can.
- Budget routes/actions require both festival-management and finance-management permissions. Approved amounts are intentionally deferred to Phase 5.
- After approval of all three migrations and deployment to an isolated test database, create a disposable festival, invitation, category, entry, and budget item. Test status transitions and deadlines, link/unlink a disposable finance entry and verify its ledger value remains unchanged, and inspect audit events. Do not write to a Preview or Production database unless it is confirmed isolated.

## Rollback

- Application-only rollback: revert the relevant phase commit on the feature branch.
- If a migration has not run, revert the code and migration file together.
- If a migration has run, do not drop its tables as an automatic rollback; preserve user data and review a recovery plan first.

## Next phases

- Budget approval workflow and approved amounts using the selected committee policy.
- Logistics checklist and participant coordination.
- Dashboard summaries, safe document links, and broader end-to-end verification.
