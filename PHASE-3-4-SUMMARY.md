# Phases 3 and 4: rehearsals, attendance and absence review

Committee routes: /admin/rehearsals, /admin/rehearsals/generate, /admin/rehearsals/[id], /admin/absences.
Member routes: /member, /member/attendance?rehearsalId=..., /member/history.

Attendance mutations validate permissions and current ACTIVE membership on the server. Rehearsal and member row locks serialize check-in, close, manual correction and review. Failed code attempts commit before errors are returned; five failures block further self check-in for that rehearsal, including a correct code. Committee correction remains available.

Close creates missing NO_RESPONSE rows with one createMany for ACTIVE members who joined by the scheduled start. Existing attempt-only rows are also queued for review. NO_RESPONSE can become ABSENT until the deadline; an ABSENT submission cannot be rewritten. ABSENT can become PRESENT only while OPEN. PRESENT cannot be changed by the member. Cancelled rehearsals reject attendance.

absenceDeadlineHours is a numeric Setting value, default 48, measured after the Nairobi rehearsal end time. Zero is supported. No new settings screen is required.

Review decisions and committee attendance changes are audited. NO_RESPONSE to PRESENT requires a note, records COMMITTEE and uses reviewStatus NONE. History shows review outcomes and notes. Bulk review is transactional.

Analytics policy is documented in src/lib/absences/counting.ts: PRESENT and EXCUSED do not count; unresolved absences and UNEXCUSED count. This includes unreviewed NO_RESPONSE.

Migration 202610120001_attendance_reviews adds the missing wrongCodeTries column, removes global uniqueness from the rehearsal-scoped four-digit code, queues legacy unreviewed absence rows and indexes the review queue. Apply with npm run db:migrate when releasing the application.

Verification: npm test; TypeScript checking; npm run test:isolated creates a temporary database schema, applies migrations, builds the app and exercises real HTTP server-action forms. It removes only its own temporary schema afterward.

Row-lock regression: pooled raw SQL defaulted to public even when Prisma ORM used the isolated schema. src/lib/row-lock.ts now explicitly qualifies locks for rehearsal, member and account operations; values remain parameterized. The existing concurrent login and invite tests cover this shared fix.

Verified: 8 unit tests, direct TypeScript checking, production Next.js build, the full isolated HTTP integration suite, and a focused attendance-guards suite all passed. The focused suite verifies cancelled and expired submissions against real actions, ACTIVE-only marking, manual correction notes, committee fallback audit records and immutable self PRESENT. Main database migrations and deployment were not run. The normal npm run typecheck wrapper could not regenerate Prisma's engine because the Windows DLL was locked; direct tsc and the production build both passed using the existing generated client.
