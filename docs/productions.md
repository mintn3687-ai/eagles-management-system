# Productions and Shows

## Routes and permissions

- `/admin/productions` and `/admin/productions/[id]`: Committee and Super Admin manage productions, cast and crew, tasks, rehearsals, show dates, call sheets, assets, and post-show notes.
- `/member/productions`: an active member views only their own call sheets for upcoming shows in active productions.
- `productions:manage` and `productions:read` are defined in `src/lib/permission-rules.ts`; every write action checks the management permission.

## Data model

- `Production` belongs optionally to a `Season`; it owns script versions, roles, crew, tasks, shows, assets, and notes. A production starts in `PLANNING`.
- `ScriptVersion` stores a version label, usage-rights notes, and an optional storage reference. Files are not uploaded by this module.
- `ProductionRole` and `Casting` record cast and understudy assignments; `CrewAssignment` records a member's crew position.
- `ProductionTask` supports an optional active-season member owner, deadline, and status.
- `ShowDate` stores a UTC instant derived from Nairobi-local date and time, plus venue. `CallSheet` records the call time and notes; `CallSheetMember` lists the people called.
- `Asset` can be shared or production-associated. Its status and holder are updated under a row lock, and every movement is audited.
- `PostShowNote` may be general or associated with one show date.
- All new records use created/updated timestamps. Foreign keys are restrictive to preserve historical records.

## Rules

- Production statuses move from planning to active or cancelled; active productions may complete or be cancelled. Closed productions cannot be edited.
- Tasks move from open to in progress, completed, or cancelled; completed and cancelled tasks cannot be reopened.
- Casting, crew assignments, task owners, asset holders, and call-sheet members must be active in the current season where applicable.
- Call sheets are only shown to called members, and only for future shows in active productions. Members cannot inspect another member's call sheet.
- An asset may be checked out only while available and checked in only while checked out. Row-level locking serializes concurrent asset movements.
- Important production, rehearsal-link, task, and asset lifecycle changes are audited. Individual call-sheet membership is not copied into the audit log; a call-sheet creation log records the count only.

## Manual checks

1. Apply `20261022090436_production_entities` to the development database with `npm run db:migrate`.
2. As Committee, create a production, add a script version with rights notes, define roles, and assign cast and crew.
3. Create tasks and attempt to reopen a completed task; the service should reject the invalid transition.
4. Link an upcoming rehearsal and schedule a show with Nairobi-local date/time.
5. Create a call sheet for active members and sign in as a called member at `/member/productions`; confirm only that member's calls are visible.
6. Add a prop, check it out to an active member, and check it in. Try a second checkout before check-in; it should be rejected.
7. Add a post-show note and confirm changes appear in the audit log.

## Limitations

- Script storage is represented by an optional reference only; upload and rights verification workflows are not included.
- Call sheets currently contain one shared set of notes; per-person call notes and notifications are not included.
- This phase does not provide public ticketing, asset condition updates after check-in, or a production archive/delete workflow.
