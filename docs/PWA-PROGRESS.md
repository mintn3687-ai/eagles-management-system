# PWA Progress

## Current state

- App: Eagles Drama Club Register, a Next.js 16 App Router app deployed on Vercel.
- Authentication: NextAuth.js v5 Credentials with email/password, bcrypt, JWT sessions, and a 24-hour maximum age. No OAuth.
- Database: Neon Postgres via Prisma.
- Protected areas: `/member/*` and `/admin/*`, guarded by `src/proxy.ts`.
- PWA work stays additive and on branch `pwa-work`. Do not merge to `main` without explicit approval.
- The handwritten service worker in `public/sw.js` is retained.

## Phase 1: Manifest and icons — DONE

- `src/app/manifest.ts` provides the web app manifest.
- Icons include `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/icon.svg`, and `public/maskable_icon_x512.png`.
- Manifest colors are `background_color: #000000` and `theme_color: #064e3b`, with a separate maskable icon.
- Verified on the Vercel preview.
- Restore points: `bc002a1` (before review), `672dd33` (Phase 1 done).

## Phase 2: Service worker — VERIFIED

- `public/sw.js` remains handwritten.
- All paths in `PRECACHE_URLS` exist in `public/`: `/offline.html`, `/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/maskable_icon_x512.png`, and `/apple-touch-icon.png`.
- Navigations use the network only; if offline, they show the cached offline page. The explicit `/member` and `/admin` bypass also prevents authenticated paths from entering the static asset cache.
- The service worker requires the public Vercel commit SHA revision and uses it for its app-prefixed cache name. Activation deletes only older caches with this app's prefix.
- `skipWaiting()` and `clients.claim()` run inside their lifecycle `waitUntil` promises.
- `src/app/service-worker-registration.tsx` fetches `/sw.js` without cache, reads the `X-PWA-Build-Revision` response header, validates it as a 40-character commit SHA, and registers the worker using that revision.
- `next.config.js` has `/sw.js`-specific no-cache response headers and exposes the revision from `VERCEL_GIT_COMMIT_SHA` when available. Existing global headers are unchanged.
- `public/offline.html` has a `#000000` page background and a “Try again” button that reloads the page.
- Phase 2 implementation was already present in the worktree; no service-worker, registration, Next.js config, or offline-page code was changed to complete this phase.
- `npm run typecheck` passed.
- `npm run build` passed.
- Verified on the Vercel Preview.
- Preview test: deploy the `pwa-work` branch to Vercel Preview; confirm `/sw.js` returns `Cache-Control: no-cache, no-store, must-revalidate` and `X-PWA-Build-Revision` with the preview commit SHA; in browser DevTools check the worker is active, then use offline mode to verify the offline fallback. Verify `/member/*`, `/admin/*`, `/login`, and `/api/*` are never served from Cache Storage.
- Rollback for this documentation-only change: `git revert <progress-record-commit>` on `pwa-work`. The Phase 2 source implementation predates this change and is not reverted by that command.

## Phase 3: Install experience — PRODUCTION DEPLOYED

- The small install component provides an Android `beforeinstallprompt` button and an iPhone Safari “Add to Home Screen” hint.
- Show the prompt only after user interaction; hide both install affordances when the app is already installed in standalone display mode.
- Do not restructure existing layouts or navigation.
- The existing component was already mounted by the root layout. It now waits for the first pointer or keyboard interaction before showing either install affordance; no layout change was needed.
- Local validation: `npm run typecheck` passed and `npm run build` passed.
- Preview test: on Android Chrome, confirm the install button stays hidden on initial load, appears after a tap or key press when install is available, launches the browser install prompt, and stays hidden when installed. On iPhone Safari, confirm the Add to Home Screen hint stays hidden on initial load, appears after interaction, expands to show instructions, and stays hidden when launched in standalone mode.
- The `pwa-work` commit `1585a69` was pushed and Vercel reported its Preview deployment completed. Physical-device behavior checks remain outstanding.
- Merged to `main` in PR #6; Vercel reported the production deployment completed and the production site returned HTTP 200.
- Rollback: `git revert <phase-3-commit>` on `pwa-work`.

## Phase 4: Push notifications — EXISTING FIREBASE IMPLEMENTATION REUSED

- The user selected Firebase Cloud Messaging. The app already has Firebase web/admin dependencies, authenticated opt-in UI, subscription endpoints, a committee announcement route, rehearsal reminders, and `PushSubscription` and `PushDelivery` Prisma models. No packages, routes, models, migrations, or other implementation files were added or changed for this phase.
- The existing opt-in UI is displayed on authenticated member and admin home pages. It requests browser notification permission only in response to the user's button action, supports turning notifications off, and requires an iPhone/iPad app to be installed to the Home Screen before enabling push.
- Sending targets active, consented user accounts with saved subscriptions. Notifications may be delivered while the account is signed out; notification text is generic and directs the user to sign in for details.
- `PushSubscription.userId` is a scalar ID with an index, but the current Prisma schema and existing migration do not enforce a relation/foreign key to `User`. The existing migration creates `PushSubscription` and `PushDelivery` only. A migration to add referential integrity was not authorized or run. Preview may share the production database; do not run any migration or notification test that writes/sends without confirming the target environment and using test devices.
- iPhone/iPad web push requires iOS/iPadOS 16.4 or later and the app added to the Home Screen.
- Existing documented Vercel environment variables:
  - Set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, and `NEXT_PUBLIC_FIREBASE_VAPID_KEY` for both Preview and Production, using Firebase web configuration appropriate to each environment.
  - Set `FIREBASE_SERVICE_ACCOUNT_JSON` as a server-only secret for Preview and Production. Use a test Firebase project/service account in Preview and the production service account in Production. Never expose it with a `NEXT_PUBLIC_` prefix.
  - Set `CRON_SECRET` for Preview and Production as a long random server-only secret; use distinct values per environment. Vercel Cron runs only on Production; invoke Preview reminder tests manually and only with test data, Firebase project, and devices.
  - Add each Preview and Production site domain to the corresponding Firebase authorized web domains.
- Verification passed locally: `npx vitest run tests/push-service.test.ts tests/push-reminder-window.test.ts` (2 files, 3 tests), `npm run typecheck`, and `npm run build`.
- Preview checks remain outstanding: configure Preview-only test Firebase values and test devices, enable notifications from a signed-in account, confirm send/receive, disable and confirm no further delivery, and avoid using production targets or user subscriptions.

## Phase 5: Testing and launch — IN PROGRESS

### Automated and read-only checks completed

- `npm test` passed: 167 Vitest tests and 8 helper tests. No database integration script was run.
- `npm run typecheck` passed.
- `npm run build` passed.
- Production `https://eagles-drama-club-register.vercel.app/manifest.webmanifest` returned HTTP 200.
- Production `/sw.js` returned HTTP 200, `Cache-Control: no-cache, no-store, must-revalidate`, and `X-PWA-Build-Revision` matching the deployed `main` commit at the time of the check.
- No code or database changes were made for Phase 5.

### Lighthouse and browser checklist

- Run Chrome Lighthouse against the production or a Vercel Preview URL on mobile and desktop. Review Performance, Accessibility, Best Practices, and SEO; Lighthouse versions may not expose a separate PWA category.
- In DevTools → Application → Manifest, verify app name/short name, start URL, theme/background colors, 192×192 and 512×512 icons, and the maskable icon.
- In DevTools → Application → Service Workers, verify the root-scoped worker is active, uses the current Vercel commit revision, and updates after a new deployment.
- Confirm the app can be installed on supported browsers and that the install UI stays hidden until interaction and after standalone installation.
- Enable offline mode and navigate to an uncached page: expect only the generic offline page, not a cached application route.
- Inspect Cache Storage: no navigations, `/api/*`, `/api/auth/*`, `/login`, `/member/*`, `/admin/*`, or user-specific responses should be cached.
- Review browser console/network output for failed service-worker registration, manifest/icon errors, CSP violations, or runtime exceptions.
- Check responsive layout, keyboard navigation, visible focus, labels, and contrast on the install UI and offline page.

### Android Chrome and iPhone Safari device plan

- Android Chrome: use a normal browser profile (not Incognito); verify no install control on first load, interact, verify the control appears only when the browser provides `beforeinstallprompt`, accept installation, launch standalone, and confirm the install control is hidden. Uninstall and repeat as needed.
- iPhone/iPad: use Safari on iOS/iPadOS 16.4 or later; first verify the hint is hidden on initial load, interact to reveal it, expand instructions, use Share → Add to Home Screen, launch from the Home Screen, and confirm standalone mode hides the hint. Push requires the installed Home Screen app.
- Repeat one online-to-offline navigation check on each device and confirm private pages do not appear from cache.
- Physical-device checks have not been performed in this session.

### Authenticated feature regression plan

Use dedicated test accounts, a planned expiry window, and a verified isolated Preview database. Preview can share Production; do not assume it is safe for test writes.

- Login: valid credentials reach the correct signed-in area; invalid credentials are rejected without exposing sensitive details.
- Logout: sign out and verify protected routes redirect to login; the old session must not restore access.
- 24-hour session: record login time, verify the session remains valid before 24 hours, then verify a request after the 24-hour JWT maximum age requires login again. Do not shorten production session settings to accelerate this check.
- Rehearsal attendance: use a disposable rehearsal and test member; mark/check attendance and confirm the saved status appears in the member and staff views.
- CSV upload/import: the app's upload surface is member CSV import. Use a small, non-sensitive test CSV; verify preview/validation and import result in the isolated test database, including duplicate/invalid rows. Do not upload real member data to Preview.
- Payments: record and inspect a clearly identified test payment only in the isolated test database; verify amount, member, date, and ledger/receipt, then clean up through supported application workflows if available.
- Push: use Preview-specific Firebase project credentials, test account/subscription, and test devices. Confirm opt-in, delivery, opt-out, and no further delivery. Do not send to Production subscribers.
- These authenticated and device-level checks have not been performed here. No database writes or notifications were sent during this phase.

### Safe branch promotion and rollback

- Before proposing a release, refresh remote refs and bring current `main` into the feature branch: `git fetch origin`, `git switch pwa-work`, then `git merge origin/main`.
- Run `npm test`, `npm run typecheck`, and `npm run build` on the combined branch. Push only `pwa-work`, inspect its Vercel Preview, and complete the device/authenticated checks above before opening a PR to `main`.
- Review the PR file diff and Preview deployment. Merge only after explicit user approval; Vercel should deploy the resulting `main` commit. Confirm the deployment status and check the production site and PWA endpoints afterward.
- For an application-only regression, use Vercel to promote the previous known-good Production deployment for immediate rollback, then create a reviewed revert PR for the offending merge commit so Git and Production agree. Do not force-push or reset shared branches.
- A database migration cannot be undone by rolling back app code. Back up/branch the database and prepare a separately reviewed forward-fix or recovery plan before any schema/data change. Phase 5 made no database changes.

## Open issues

- Phase 2 was verified on the Vercel Preview.
- Phase 3 is deployed to Production; Android Chrome and iPhone Safari device checks remain outstanding.
- Phase 4 reuses the existing Firebase implementation; Preview testing and a decision about database foreign-key enforcement remain outstanding.
- Phase 5 automated tests, typecheck/build, and public PWA endpoint checks passed. Manual Lighthouse/device/authenticated checks remain outstanding and require safe test accounts/devices and confirmation that Preview uses an isolated database.
- At the time this progress record was updated, remote `main` had one newer commit than local `pwa-work`; refresh and merge `origin/main` into `pwa-work` before the next release PR. Do not merge to `main` without explicit approval.
- Stop after each phase and wait for the user to say “continue”.
