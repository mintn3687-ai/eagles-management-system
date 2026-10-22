# Phase 9 security and performance review

## Server entry point access matrix

| Entry point | Required access | Enforcement |
| --- | --- | --- |
| `/api/auth/[...nextauth]` GET/POST | Public Auth.js protocol | Auth.js Credentials provider validates credentials and CSRF; passwords are never accepted as an app session token. |
| `/api/invites` POST | COMMITTEE | Route calls `requireRole`; `createInvite` repeats the check. Origin and Zod body validation are applied. |
| `/login` action | Public | Zod credentials schema; Auth.js is the authentication boundary; login limiter plus account lockout. |
| `/invite/[token]` action | Public one-time invite capability | Strict token/password Zod schema; token hash, expiry and one-time transactional claim checked in service; IP and token limits. |
| `/consent` action | Signed-in user | `requireUser`, consent Zod schema. |
| `/logout` action | Signed-in user | `requireUser`, then Auth.js sign-out. |
| `/member/attendance` actions | Signed-in active member | Service calls `requireUser`, verifies member/consent/status, parses rehearsal ID/code/reason and applies attempt/deadline/double-mark checks. |
| `/admin` and `/admin/layout` | COMMITTEE | `pageUser('COMMITTEE')`. |
| `/admin/absences` actions | COMMITTEE | Absence service `requireRole('COMMITTEE')`; strict single/bulk schemas. |
| `/admin/analytics`, `/admin/analytics/[memberId]` | COMMITTEE | `pageUser('COMMITTEE')`; IDs/month/sort inputs use Zod. |
| `/admin/audit` | COMMITTEE | `requireRole('COMMITTEE')`; search and page are validated. |
| `/admin/fees` page and save action | COMMITTEE page; SUPER_ADMIN fee changes | Page requires COMMITTEE; action requires SUPER_ADMIN and fee-setting Zod schema. |
| `/admin/members`, `/new`, `/[id]`, `/import` and member actions | COMMITTEE | Page/action/service checks; IDs, details, role/status changes and bounded CSV imports use Zod. Existing super-admin role cannot be changed via the member editor. |
| `/admin/rehearsals`, `/[id]`, `/generate` and rehearsal actions | COMMITTEE | Page checks plus service `requireRole('COMMITTEE')`; rehearsal IDs, time/date, statuses, reasons and bounded weekly generation use Zod. |
| `/admin/payments`, `/[id]` and payment actions | COMMITTEE | Pages/actions require COMMITTEE; member/type/method/date/reason inputs validated. Amount and fee type are resolved from current database fee and member status. |
| `/admin/settings` page and action | SUPER_ADMIN | Page and management service require SUPER_ADMIN; settings schema bounds all values. |
| `/admin/team` page and actions | SUPER_ADMIN | Page and management service require SUPER_ADMIN; member IDs/roles validated and transfer uses explicit confirmation. |
| `/admin/rollover` page and action | SUPER_ADMIN | Page and management service require SUPER_ADMIN; selected IDs/status and confirmation validated. |
| `/admin/export` GET | SUPER_ADMIN | Route calls `requireRole('SUPER_ADMIN')`; cursor batches are bounded. |
| `/admin/analytics/export` GET | COMMITTEE | Route calls `requireRole('COMMITTEE')`; query inputs validated. |
| `/admin/members/export` GET | COMMITTEE | Route calls `requireRole('COMMITTEE')`; filter inputs validated. |
| `/admin/payments/export` GET | COMMITTEE | Route calls `requireRole('COMMITTEE')`; filter inputs validated. |

## Review findings and fixes

- Added a PostgreSQL-backed fixed-window limiter. It stores only a SHA-256 digest of the identity, increments atomically, and prunes a bounded batch of expired keys on a small fraction of requests. Login is limited by IP and normalized email; invite creation and acceptance, check-in, and committee payment recording have limits. Account lockout remains as a second login control.
- All interactive lists examined use bounded pages or bounded recent-item takes. The rehearsal attendance sheet was unbounded; it now displays 20 active members per page. Full export uses sequential 500-row cursor batches. Session close loads active member IDs for one bulk attendance insert; this is proportional to club size and has no per-member query loop.
- Database access found no N+1 query loops. Monthly attendance analytics use grouped SQL. The Phase 8 and Phase 9 migrations include indexes for the reviewed filter/order paths and rate-limit cleanup.
- No server-side PDF generation, polling loop, or application console logging was found. Export `while` loops read bounded database pages until exhausted; they do not poll or wait. Browser print is client-side.
- `next.config.js` now sends CSP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, and production HSTS. CSP permits inline styles and Next's inline bootstrap scripts; revisit if the UI can move to nonce-based CSP.
- No secret literal was found in `src`; client components do not read server secrets. Credentials and tokens are stored/handled server-side. The app source scan did not read local environment files.
- Tap controls use the shared 48px button/input minimum; small-screen rehearsal attendance remains horizontally scrollable. Labels and alert/status roles are present on reviewed forms. A browser-based contrast audit was not available in this environment.

## Payment callback gap

There is no payment initiation API or provider callback handler in this codebase. `src/lib/mpesa.ts` explicitly disables production M-Pesa and returns a development-only fake result. Adding tests for callback success, duplicate delivery, amount mismatch and provider failure would require inventing a callback protocol and adding payment behavior, outside this security-only phase. No callback tests can truthfully be run until the provider integration and its signature/credential contract exist.

## Test coverage

Vitest covers the shared server role guard for each admin page/export route role matrix, check-in code/attempt/double-mark rules, Nairobi-derived absence deadline boundary, analytics classification/counting, effective fee version selection and Kenyan phone normalization. The legacy helper tests remain in `npm test`. Payment callback scenarios remain untestable for the reason above.
