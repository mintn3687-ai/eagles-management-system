# Festival Planning

## Current phase

Phases 2–8 provide an admin-only festival register, festival details, invitation and entry tracking, configurable categories and deadlines, festival budget lines, explicit finance-ledger links, approval workflows, logistics coordination, a planning dashboard, and private festival document uploads. Committee members and super admins with the centralized festival and finance permissions can manage these records. Administrators can download a complete proposal PDF from a festival detail page.

Any committee member with festival approval and finance permissions may approve or reject a festival proposal, including their own submission. Submitting the overall plan also submits unapproved budget lines for review. One overall decision approves or rejects the pending plan and all pending budget requests at their planned amounts; already-approved budget lines keep their recorded decisions. Rejections require a reason. Decisions record the submitter, approver, timestamps, amounts, and reason. The current decisions are shown on the festival page and earlier decisions are retained in the audit log. Editing approved festival details, invitations, categories, entries, budget lines, or logistics returns the plan to Pending. Saving an unchanged record does not reset its approval.

## Database change

Phase 2 adds the `FestivalStatus` enum and `Festival` model. Phase 3 adds invitation and entry models. Phase 4 adds `FestivalBudgetType`, `FestivalBudgetItem`, and `FestivalFinanceLink`. Existing Prisma model definitions were not changed. IDs linking these feature records to festivals, productions, finance entries, and users are scalar IDs validated by the feature service because existing model relations are not being edited.

Migration file: `prisma/migrations/20261024090000_festival_planning/migration.sql`.
Phase 3 migration file: `prisma/migrations/20261024100000_festival_entries/migration.sql`.
Phase 4 migration file: `prisma/migrations/20261024110000_festival_budget_finance/migration.sql`.
Phase 5 migration file: `prisma/migrations/20261024120000_festival_approvals/migration.sql`.
Phase 6 migration file: `prisma/migrations/20261024130000_festival_logistics/migration.sql`.
Document metadata migration: `prisma/migrations/20261024140000_festival_documents/migration.sql`.

The six Festival Planning migrations were applied to the user-confirmed Production database on 24 October 2026 and `prisma migrate status` verified that its schema is up to date. This proposal PDF and unified-decision update reuse the existing schema and require no new migration. Preview may share Production data, so verify the target database and R2 bucket before write testing.

### Migration procedure

Only after the user explicitly approves the migrations and the target is confirmed to be an isolated development/test database, configure Prisma's `DATABASE_URL_UNPOOLED` (`directUrl`) for that isolated database, then run `npx prisma migrate deploy` and verify with `npx prisma migrate status`. Do not apply these migrations to Preview or Production without separate explicit approval. No migration command was run as part of this implementation.

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
11. Submit the festival plan for approval. All budget lines that are not already approved are included as pending budget requests. Download the proposal PDF from the Festival plan approval section to review festival details, entries, deadlines, budget and linked actuals, approval history, logistics, and the document register.
12. Committee members with festival approval and finance permissions use the single Festival plan approval section to approve or reject the plan and all pending budget requests together. Rejection requires a reason. Previously approved budget lines retain their recorded decisions.
13. Review the approval status, submitter, decision-maker, timestamps, approved amount, and reason on the festival details page. Editing an approved plan or budget item returns the changed request to Pending; the proposal can then be resubmitted for review.
14. Add logistics checklist items for transport, accommodation, meals, schedules, venue, contacts, equipment, costumes, props, and participant coordination. Add an optional due date and assign one responsible current-season active member. Update the item details or move it between Open, In progress, and Completed; completion records the person and timestamp, and incomplete past-due items are marked overdue. Use the details field only for coordination information that is necessary; avoid unnecessary personal data.
15. Upload supporting PDF, DOCX, XLSX, PNG, or JPEG documents (up to 20 MB) in the festival details page. Uploads go to a private Cloudflare R2 bucket; only authorized festival managers can request a short-lived download link or remove a file. Incomplete uploads remain marked Pending and can be removed. Upload start, completion, and deletion are audited.

The dashboard shows upcoming festivals, overdue and next-30-day deadlines, entry status, planned/approved/actual budget totals, pending approvals, and incomplete logistics. Document metadata stores only the festival ID, display name, allowed content type, byte size, private object key, uploader ID, and upload state; file bytes are not stored in Postgres.

### Cloudflare R2 configuration

The app uses the Cloudflare R2 S3 API with the bucket name and AWS-style credential variables configured in `.env.local` or the deployment environment: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` (`auto` for R2), and `AWS_BUCKET_NAME`. The credentials and endpoint must belong to the same Cloudflare R2 account and bucket. Never print, commit, or copy secret values into a Preview or Production environment without intentionally selecting that target.

Object keys are generated server-side and scoped under a festival. Uploads use a short-lived (10-minute) presigned `PUT` URL, and the server verifies the stored object's size and content type before marking it Ready. Downloads use a 60-second presigned URL with attachment disposition. Uploading requires a bucket CORS policy that allows `PUT` from the exact app origins and permits the `Content-Type` request header. Configure development, Preview, and Production origins deliberately in the Cloudflare dashboard; do not use a wildcard for a private documents bucket. Cloudflare documents this requirement in [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) and [bucket CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).

The configured R2 bucket and credentials are external infrastructure. The Production R2 CORS policy allows the confirmed Production origin and the explicitly approved deployment preview origin for `PUT` requests with the `Content-Type` header. Confirm any new Preview origin is added deliberately before testing uploads. `.env.example` lists variable names only.

## Safe verification

- Run `npx vitest run tests/festivals.test.ts tests/festivals-service.test.ts tests/festivals-documents.test.ts tests/festivals-document-routes.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.
- Verify a Member cannot access `/admin/festivals`, while Committee and Super Admin can.
- The festival register and detail pages require festival-management and finance-management permissions because the overview exposes financial totals; mutations validate their specific festival, finance, or approval permission at the server action.
- Verify the dashboard only includes open invitation/entry/logistics deadlines through the next 30 days, marks overdue items, and shows the correct per-festival entry, approval, budget, and logistics summaries.
- Budget routes/actions require both festival-management and finance-management permissions. Approval decisions require the centralized festival-approval permission; finance-management permission is additionally checked for decisions.
- Document upload initialization, completion, download-link issuance, and deletion require both festival-management and finance-management permissions, same-origin state changes, and festival-scoped document IDs. Uploads are limited server-side to 20 MB and the supported file extensions; the storage policy also constrains the signed upload's exact byte size and content type.
- After separate approval of all six migrations and deployment to an isolated test database, create a disposable festival, invitation, category, entry, budget item, logistics item, and document. Test status transitions and deadlines, submit and decide plan/budget approvals (including a partial amount and required reason), edit an approved plan and budget item to verify they return to Pending, assign an active member to a logistics item, complete and reopen it, verify completion metadata and overdue status, link/unlink a disposable finance entry and verify its ledger value remains unchanged, and inspect audit events. After confirming the target R2 bucket and its CORS origin are safe for testing, verify upload, pending-upload cleanup, authorized download, unauthorized denial, and deletion. Do not write to a Preview or Production database or bucket unless it is explicitly intended.

## Rollback

- Application-only rollback: revert the relevant phase commit on the feature branch.
- If a migration has not run, revert the code and migration file together. The application does not manage or provision the R2 bucket.
- If a migration has run, do not drop its tables as an automatic rollback; preserve user data and review a recovery plan first.
- If a bucket is provisioned later, do not delete it as part of an application rollback until its documents have been exported and the user explicitly approves the storage deletion.

## Next phases

- Permission/validation review, broader end-to-end verification, and safe release handoff.
