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

## Phase 2: Service worker — IMPLEMENTED; local checks passed

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
- Preview test: deploy the `pwa-work` branch to Vercel Preview; confirm `/sw.js` returns `Cache-Control: no-cache, no-store, must-revalidate` and `X-PWA-Build-Revision` with the preview commit SHA; in browser DevTools check the worker is active, then use offline mode to verify the offline fallback. Verify `/member/*`, `/admin/*`, `/login`, and `/api/*` are never served from Cache Storage.
- Rollback for this documentation-only change: `git revert <progress-record-commit>` on `pwa-work`. The Phase 2 source implementation predates this change and is not reverted by that command.

## Phase 3: Install experience — NOT STARTED

- Add a small install component with an Android `beforeinstallprompt` button and an iPhone Safari “Add to Home Screen” hint.
- Show the prompt only after user interaction; hide both install affordances when the app is already installed in standalone display mode.
- Do not restructure existing layouts or navigation.

## Phase 4: Push notifications — NOT STARTED

- First recommend Firebase Cloud Messaging or OneSignal and explain the trade-offs; wait for the user's choice before installing anything.
- Any subscription storage must use a new Prisma model linked to the existing `User` by ID. Do not alter existing models.
- Show migration SQL and wait for approval before running it against any database. Warn that Preview may share the production database before any write.
- Request notification permission only after an explicit button tap and only for logged-in users. Send only to opted-in users and provide a way to turn notifications off.
- Explain that iPhone web push requires installing the app to the Home Screen and iOS 16.4 or later.
- List required environment variables and whether each belongs in Preview, Production, or both.

## Phase 5: Testing and launch — NOT STARTED

- Provide a Lighthouse PWA checklist and test plans for Android Chrome and iPhone Safari.
- Check login, logout, 24-hour session expiry, rehearsal attendance, uploads, and payments.
- Explain how to bring newer `main` commits into `pwa-work`, test the combined code on a Preview deployment, and safely merge only after approval.
- Provide a production rollback plan.

## Open issues

- Phase 2 code was already present and no implementation files needed changes in this session. Local typecheck and build passed; Vercel Preview verification remains outstanding.
- Stop after each phase and wait for the user to say “continue”.
