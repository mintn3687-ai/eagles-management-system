# Phase 2: member management

The committee member register is at `/admin/members`.

- Search name, normalized phone or email; filter by status; sort by name or join date in either direction; 20 records per page.
- Add and edit member details, with normalized Kenyan phone numbers and lowercase emails protected by database uniqueness constraints.
- Creating a member creates a MEMBER login and a seven-day invitation, with copyable link and WhatsApp message. Existing members start ACTIVE; others start PENDING_REGISTRATION.
- Change status with a required reason for INACTIVE or SUSPENDED. The application has no member deletion action.
- Regenerate invitations to replace earlier links and reset passwords. Completing a password reset invalidates older sessions.
- Import up to 500 CSV rows with preview, validation, duplicate detection and atomic confirmation. Imported members start PENDING_REGISTRATION; complete emergency contacts and generate invitations from their detail pages.
- Export the complete filtered list as CSV, independent of pagination.
- Record create, edit, status, import, invitation and role changes in AuditLog. Only SUPER_ADMIN can change roles.
- Attendance and payment sections remain placeholders.

## Empty database setup

Store the pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED` in ignored `.env.local`. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then run:

```sh
npm run db:migrate
npm run db:bootstrap
```

Bootstrap creates only the administrator and preserves an existing account. `db:seed` is a separate demo-data command and is not needed for an empty member register. Sign in with the configured administrator credentials and accept consent before opening the committee pages.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run test:isolated
```

The isolated suite requires database connectivity. It migrates a randomly named test schema, builds into `.next-integration` to avoid conflicts with a running development server, starts a server on port 3102, tests real HTTP forms and 500-row imports, and removes only that test schema on completion. It does not add test members to the public register.
