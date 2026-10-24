# Festival Planning

## Current phase

Phase 2 provides an admin-only festival register and festival details form. Committee members and super admins with the centralized `festivals:manage` permission can create and update festival name, year, organizer, venue, dates, status, and notes.

The selected approval rule for later phases is that any committee member may approve a festival plan or budget, including their own submission. This choice does not add an approval workflow in Phase 2.

## Database change

Phase 2 adds only the `FestivalStatus` enum and `Festival` Prisma model. The new model stores the creator as `createdById`; existing Prisma models were not changed. This project’s constraint to avoid editing existing Prisma models means the creator ID is stored as a scalar rather than an ORM relation.

Migration file: `prisma/migrations/20261024090000_festival_planning/migration.sql`.

No database migration was run. Preview may share Production data, so verify the target database is isolated and explicitly approve before deploying this migration to any database.

## How to use

1. Sign in with a Committee or Super Admin account.
2. Open **Festivals** in the admin navigation.
3. Create a festival record. Dates are optional until known.
4. Open the festival to update its details and planning status.

No additional environment variables or file-storage provider are required. Document attachments are not included in this phase.

## Safe verification

- Run `npx vitest run tests/festivals.test.ts`, `npm run typecheck`, and `npm run build`.
- Verify a Member cannot access `/admin/festivals`, while Committee and Super Admin can.
- After migration approval and deployment to an isolated test database, create a disposable festival, update it, and verify the audit log. Do not write to a Preview or Production database unless it is confirmed isolated.

## Rollback

- Application-only rollback: revert the Phase 2 commit on the feature branch.
- If the migration has not run, the migration file and Prisma model can be reverted with that code change.
- If the migration has run, do not drop the festival table as an automatic rollback; preserve user data and review a recovery plan first.

## Next phases

- Festival invitations, entries, categories, submission status, and deadlines.
- Budget requests, explicit links to existing finance entries, and audit trail.
- Approval workflow using the selected committee policy.
- Logistics checklist and participant coordination.
- Dashboard summaries, safe document links, and broader end-to-end verification.
