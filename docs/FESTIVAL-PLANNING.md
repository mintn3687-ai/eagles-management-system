# Festival Planning

## Current phase

Phases 2–8 provide an admin-only festival register, festival details, invitation and entry tracking, configurable categories and deadlines, festival budget lines, explicit finance-ledger links, approval workflows, logistics coordination, and a planning dashboard. Committee members and super admins with the centralized festival and finance permissions can manage these records.

Any committee member may approve a festival plan or budget, including their own submission. Budget approvals may be partial; a reason is required when the approved amount is below the requested amount. Rejections require a reason. Approval decisions record the submitter, approver, timestamps, amounts, and reason. The current decision is shown on the festival page and earlier decisions are retained in the audit log. Editing an approved plan or budget item automatically returns it to Pending and submits the changed request again. Saving an unchanged record does not reset its approval.

## Database change

Phase 2 adds the `FestivalStatus` enum and `Festival` model. Phase 3 adds invitation and entry models. Phase 4 adds `FestivalBudgetType`, `FestivalBudgetItem`, and `FestivalFinanceLink`. Existing Prisma model definitions were not changed. IDs linking these feature records to festivals, productions, finance entries, and users are scalar IDs validated by the feature service because existing model relations are not being edited.

Migration file: `prisma/migrations/20261024090000_festival_planning/migration.sql`.
Phase 3 migration file: `prisma/migrations/20261024100000_festival_entries/migration.sql`.
Phase 4 migration file: `prisma/migrations/20261024110000_festival_budget_finance/migration.sql`.
Phase 5 migration file: `prisma/migrations/20261024120000_festival_approvals/migration.sql`.
Phase 6 migration file: `prisma/migrations/20261024130000_festival_logistics/migration.sql`.

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
11. Submit the festival plan and each budget item for approval. Committee members with approval and finance permissions can approve or reject pending requests. Enter an approved amount for a budget request; reduced amounts require a reason, and rejected requests require a reason. A rejected request can be submitted again.
12. Review the approval status, submitter, decision-maker, timestamps, approved amount, and reason on the festival details page. Editing approved plan details or an approved budget item automatically resubmits that changed record.
13. Add logistics checklist items for transport, accommodation, meals, schedules, venue, contacts, equipment, costumes, props, and participant coordination. Add an optional due date and assign one responsible current-season active member. Update the item details or move it between Open, In progress, and Completed; completion records the person and timestamp, and incomplete past-due items are marked overdue. Use the details field only for coordination information that is necessary; avoid unnecessary personal data.

The dashboard shows upcoming festivals, overdue and next-30-day deadlines, entry status, planned/approved/actual budget totals, pending approvals, and incomplete logistics.

Document uploads are not included. The existing production module stores an optional file reference but does not upload or store files, so it is not a safe file-storage pattern to reuse. No new storage provider has been introduced; choose and approve a storage approach before adding document uploads or links that depend on it.

## Safe verification

- Run `npx vitest run tests/festivals.test.ts tests/festivals-service.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.
- Verify a Member cannot access `/admin/festivals`, while Committee and Super Admin can.
- The festival register and detail pages require festival-management and finance-management permissions because the overview exposes financial totals; mutations validate their specific festival, finance, or approval permission at the server action.
- Verify the dashboard only includes open invitation/entry/logistics deadlines through the next 30 days, marks overdue items, and shows the correct per-festival entry, approval, budget, and logistics summaries.
- Budget routes/actions require both festival-management and finance-management permissions. Approval decisions require the centralized festival-approval permission; finance-management permission is additionally checked for decisions.
- After separate approval of all five migrations and deployment to an isolated test database, create a disposable festival, invitation, category, entry, budget item, and logistics item. Test status transitions and deadlines, submit and decide plan/budget approvals (including a partial amount and required reason), edit an approved plan and budget item to verify they return to Pending, assign an active member to a logistics item, complete and reopen it, verify completion metadata and overdue status, link/unlink a disposable finance entry and verify its ledger value remains unchanged, and inspect audit events. Do not write to a Preview or Production database unless it is confirmed isolated.

## Rollback

- Application-only rollback: revert the relevant phase commit on the feature branch.
- If a migration has not run, revert the code and migration file together.
- If a migration has run, do not drop its tables as an automatic rollback; preserve user data and review a recovery plan first.

## Next phases

- Permission/validation review, broader end-to-end verification, and safe release handoff.
