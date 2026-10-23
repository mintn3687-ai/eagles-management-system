# Eagles Drama Club Register

Mobile-first web app for managing drama club members, attendance, and payments in Kenya.

## Project Structure

```
/eagles-drama-club-register
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore patterns
├── next.config.js        # Next.js configuration
├── package.json          # Project dependencies and scripts
├── prisma/
│   ├── migrations/       # Additive database migrations
│   ├── schema.prisma     # Prisma data model
│   └── seed.ts           # Fictional sample data
├── src/
│   ├── app/              # Next.js App Router pages and route handlers
│   ├── components/       # Shared and feature UI
│   ├── lib/              # Auth, data access helpers, permissions, validation
│   ├── modules/          # Feature schemas, services, repositories, and actions
│   └── proxy.ts          # Route-level session gate
├── tests/                # Vitest, helper, and integration tests
└── docs/                 # Feature data models and operating rules
```

## Installation

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in the required variables
3. Run `npm install` to install dependencies
4. Run `npm run db:migrate` to create database tables
5. Run `npm run db:seed` to populate with sample data
6. Run `npm run dev` to start the development server

### Recovering a Super Admin password

If you have authorized database access but cannot sign in as a Super Admin, run
`npm run db:reset-admin-password` from an interactive terminal. It loads the
local environment, displays the database host/name (never the connection
credentials), requires confirmation of both the target account and database,
and prompts for the new password without echoing it. It only resets an existing,
active `SUPER_ADMIN` account and clears its failed-login lockout; it does not
create accounts, change roles, or activate users. Before running it for a
deployment, temporarily configure `DATABASE_URL` for that deployment's
database, verify the displayed target carefully, then restore your local
development configuration. Never put a password in a command argument or
commit environment files.

## Existing Features

### Database Schema
- **User**: Authentication with roles (MEMBER, COMMITTEE, SUPER_ADMIN)
- **Member**: Club member records with Kenyan phone format validation
- **Invite**: User invitation system
- **Rehearsal**: Schedule management with check-in codes
- **Attendance**: Present/absent tracking with committee review
- **FeeSetting**: Configurable fees (Registration and Subscription)
- **Payment**: Payment processing with M-Pesa integration support
- **Setting**: Club-wide configuration settings
- **AuditLog**: Activity tracking

### Core Functionality
- Secure authentication with Auth.js
- Kenyan phone number normalization
- Role-based access control
- Zod validation for all inputs
- Africa/Nairobi timezone handling
- Money stored as whole Kenya shillings
- Index optimization for common queries
- Existing records receive creation/update timestamps through an additive migration; existing finance amounts remain whole KES integers.

Apply the `202610230004_model_timestamps` migration with `npm run db:migrate`.

## Phase 1: Seasons and Member History

- Season and season-specific membership records preserve each member's status and club position across annual rollovers.
- New members and imported members are linked to the selected current season. Successful payments are attributed to their season and reflected in the season fee totals.
- The Super Admin manages seasons at `/admin/rollover`; Committee and Super Admin can review member attendance and payment summaries at `/admin/members/[id]`.
- Member attendance summaries use the same closed-rehearsal eligibility and excused-absence rules as analytics. Monetary totals are whole KES.
- Season lifecycle changes are audited. New-season membership snapshots are stored as a SHA-256 digest; the previous season's membership rows remain unchanged.
- Access is enforced through the central permissions layer: `seasons:manage` is Super Admin-only, while `members:read` and `payments:manage` are available to Committee and Super Admin.

Read [docs/seasons.md](./docs/seasons.md) for the model, rollover rules, and manual verification steps.

## Phase 2: Meetings and Governance

- Committee and Super Admin can manage meetings, agenda items, attendance, quorum, minutes, motions, and action items at `/admin/meetings`.
- Eligible active-season members are frozen into the meeting attendance register at creation. Quorum percentage is configurable per meeting; the required count is rounded up.
- Minutes can be saved as drafts and published only after the meeting is completed and quorum has been reached. Approval is audited and locks the meeting record.
- Committee and Super Admin can view approved minutes and record motion decisions; motions require quorum. Action items can be assigned to frozen eligible members, tracked, and audited.
- Signed-in members can view approved minutes and only their own action items at `/member/meetings`.
- Permissions are centralized: `meetings:manage` is available to Committee and Super Admin; `meetings:read` is available to all authenticated roles. Suspended/inactive accounts remain subject to the existing access restrictions.

Read [docs/meetings.md](./docs/meetings.md) for lifecycle, quorum, visibility, and manual verification details.

## Phase 3: Elections and Secret-Ballot Voting

- Committee and Super Admin manage elections at `/admin/elections`; members nominate themselves and vote at `/member/elections`.
- An election progresses through draft, nominations open, voting open, closed, and results published. Active-season and fee-current eligibility settings are frozen when voting opens.
- Each eligible member submits one ballot containing one choice per office. Candidate, abstain, and none-of-the-above choices are supported; each office has a configurable tie rule. Unique voter/office receipts and ballot/office choices enforce one selection per office.
- Voter receipts and ballots are stored in separate tables with no foreign key or ballot identifier connecting them. The application exposes only aggregate results after a Committee member or Super Admin approves and publishes them. A candidate cannot approve their own results.
- Election lifecycle and nomination-review changes are audited. Individual choices are never written to the audit log.

Apply the additive `202610230002_elections_secret_ballot` migration with `npm run db:migrate`. Read [docs/elections.md](./docs/elections.md) for the data model, voting rules, routes, and manual checks.

## Phase 4: Productions and Shows

- Committee and Super Admin manage productions at `/admin/productions`; production detail includes script versions and rights notes, roles and casting/understudies, crew, tasks, rehearsal links, show dates, call sheets, assets, and post-show notes.
- Production and task lifecycles are validated in the service. Important changes are audited; asset check-out/check-in is row-locked to prevent simultaneous conflicting movements.
- Call sheets can include only active members in the current season. Members can view only their own upcoming calls for active productions at `/member/productions`.
- Assets may be assigned to a production or retained in the shared club register. Existing rehearsal and attendance workflows remain unchanged; rehearsal links are optional.
- Permissions are centralized: `productions:manage` is available to Committee and Super Admin; `productions:read` is available to members and higher roles.

Apply the additive `20261022090436_production_entities` migration with `npm run db:migrate`. Read [docs/productions.md](./docs/productions.md) for the data model, lifecycle rules, routes, and manual checks.

## Phase 5: Complete Finance

- Committee and Super Admin manage season/production budgets, categorized income and expense entries, reimbursement approval and payment, fundraising campaigns, donations, and sponsorships at `/admin/finance`.
- Active current-season members submit and track their own reimbursement requests at `/member/reimbursements`. Approved reimbursements are marked paid with a payment reference and create a finance expense entry.
- Ticket types, sales, guest lists, and partial refunds are tracked for scheduled production shows. Ticket capacity and cumulative refund limits are enforced by services and database constraints where applicable.
- Payment and box-office statement entries reconcile against successful member payments or ticket sales using exact method/reference/amount matches. Reports export CSV for all finance records, a season, a production, or a combined scope.
- Finance permissions are centralized: `finance:manage` is Committee and Super Admin; `fees:manage` is Super Admin-only; `reimbursements:request` is for signed-in member roles and requires active current-season membership. M-Pesa remains simulated unless a real integration is separately enabled.

Apply the additive `202610230003_phase5_finance_operations` migration with `npm run db:migrate`. Read [docs/finance.md](./docs/finance.md) for the data model, money rules, routes, manual checks, and limitations.

### Sample Data
- One Super Administrator
- Five sample members (including alumni, pending, active)
- Three rehearsals (scheduled, open, closed)
- Example fees (Registration: 500 KES, Subscription: 200 KES monthly)
- Default club settings

## Environment Variables

For local development, copy `.env.example` to the git-ignored `.env.local` and
keep `AUTH_URL=http://localhost:3000`. Use development Neon credentials and a
local `AUTH_SECRET`; never commit `.env.local`.

Configure Vercel environment variables separately in the project's Vercel
Settings → Environment Variables. For the Production environment set:

- `AUTH_URL=https://eagles-drama-club-register.vercel.app`
- `AUTH_TRUST_HOST=true`
- `AUTH_SECRET` to a strong secret stored only in Vercel, distinct from the
  local secret
- `DATABASE_URL` to the production Neon pooled connection
- `DATABASE_URL_UNPOOLED` to the direct production Neon connection for
  migrations

Use a separate Neon development branch for local credentials and the production
branch for Vercel. Apply migrations to each intended database only after
checking which connection is active with `npm run db:migrate`. If using Vercel
Preview deployments for sign-in, set `AUTH_URL` to that preview's origin in its
Preview environment. The app uses relative routes; no production URL should be
hardcoded into local configuration. Keep all secrets out of GitHub. M-Pesa
variables are optional and live payment processing remains disabled in this
phase.

Copy `.env.example` to `.env.local`, then set the local values described above. Use the Vercel project settings for production values; never paste real credentials into this document.
## API Endpoints

The application provides RESTful API endpoints for:
- Member management (create, read, update)
- Rehearsal scheduling
- Attendance marking and review
- Payment processing
- User authentication

## Testing

Run the following commands:

```bash
# Type checking
npm run typecheck

# Build application
npm run build

# Run application
npm run start
```

## Technology Stack

- Next.js (App Router) with TypeScript
- Tailwind CSS for styling
- Prisma ORM with PostgreSQL
- Auth.js for authentication
- Zod for validation
- React with client components

## Assumptions

1. The application runs on a free tier, so server operations are optimized for performance
2. All dates are calculated and displayed in Africa/Nairobi timezone
3. Money is stored as integers (whole Kenya shillings)
4. Fee amounts are controlled by the committee through the database
5. There is no public signup - all users are added by committee members
6. Mobile-first design with large tap targets for ease of use
7. Kenyan phone numbers are normalized to the format 2547XXXXXXXX

## Project Notes

The project is being extended incrementally. New feature work uses `src/modules/<feature>/` with validation schemas, business services, Prisma repositories, and thin server actions. Pages and components call server actions or read services rather than Prisma directly. Existing `src/lib/` feature services are migrated gradually to avoid breaking established workflows.

## Architecture Rules

Use these rules as the default standard for all code in the repository:

- App routes may call service functions.
- Services may call repositories.
- Repositories may call Prisma.
- Utilities should avoid database access unless they are truly shared, non-domain helpers.
- Components should not call Prisma directly and should not contain business logic.
- Each feature module should expose a narrow public API built around repository/service boundaries.
- Permission and access checks should be centralized rather than repeated across routes, components, and services.
- Keep `src/lib/` focused on cross-cutting utilities like dates, validation, formatting, auth helpers, and generic permission primitives.
- Prefer thin route orchestration and domain logic inside the owning module.

This keeps the architecture consistent as the project grows and prevents new logic from reintroducing legacy patterns.

## License

MIT License