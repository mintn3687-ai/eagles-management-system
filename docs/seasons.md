# Seasons and Member History

## Purpose and access

The seasons module records membership per club season so a rollover does not erase prior statuses. `seasons:manage` is restricted to Super Admins. Committee and Super Admin can read member attendance and payment summaries with `members:read`; payment recording remains available with `payments:manage`.

Routes:

- `/admin/rollover` — create the next season and carry forward current memberships.
- `/admin/members/[id]` — review a member's attendance and fee summaries.
- `/admin/payments` — record payments and waivers, which update the matching season totals.

## Data model

- `Season` stores a name, inclusive Nairobi start/end dates, a single current-season flag, and an optional membership snapshot hash.
- `SeasonMembership` links one member to one season and stores that season's membership status, whole-KES `feesOwed` and `feesPaid`, and `roleInSeason`.
- `Payment.seasonId` associates a payment with the season containing its Nairobi payment date. It is nullable to preserve records outside configured season dates.
- Database constraints prevent negative fee totals, duplicate member-season links, and more than one current season. The season service rejects overlapping date ranges.

The migration creates a current `2026 Drama Club Season` for 2026-01-01 through 2026-12-31 in Africa/Nairobi time. It backfills every existing member's current-season status, initializes owed fees to zero, and sums successful in-season payments into `feesPaid`. Existing member records and payments are retained.

`roleInSeason` is a club position, not a login permission. New memberships default to `MEMBER`; changing global account roles does not change this field. For compatibility with existing screens and attendance history, global `Member.status` remains synchronized for current-season status changes. Previous `SeasonMembership` rows are not changed on rollover.

## Rollover rules

1. Only a Super Admin can create a new current season.
2. The new start date must be after the inclusive end date of the current season and cannot overlap another season.
3. Every current membership is carried forward with its season role. New-season fee totals start at zero; owed fees are not inferred.
4. An optional selection of up to 50 active members on the displayed page can be marked inactive or alumni in the new season. Those changes also update the legacy global status projection and status history.
5. A sorted SHA-256 digest over each carried member ID, season status, and season role is saved on the new season. The snapshot contains no passwords or payment references.
6. Season creation, membership status changes, and snapshot metadata are written to the audit log in the same transaction.

Attendance summaries reuse the existing analytics eligibility rules: closed rehearsals only, active status history on the rehearsal date, and excused absences are excluded from the attendance-rate denominator. Payment summaries show the current season's fee totals and recent payment activity. All dates are displayed in Africa/Nairobi time.

## Manual verification

1. Sign in as Super Admin and open `/admin/rollover`.
2. Confirm the current season, enter a non-overlapping next-season date range, and type `ROLLOVER`.
3. Optionally select active members to carry forward as inactive or alumni, then create the next season.
4. Confirm the previous season remains in the database and the new season has one membership per carried member, preserved roles, and zero initial fee totals.
5. Open `/admin/members/[id]` and verify attendance counts/rate, current-season fee totals, and recent payments.
6. As Committee, record or waive a payment dated within the current season and verify `Payment.seasonId` and that member's `feesPaid` remain consistent. Payments dated outside all configured season periods remain unassigned.

## Limitations

- Only the current season is created by the rollover screen; historical seasons are retained but there is not yet a season history browser or a separate editor for historical membership records.
- The rollover screen offers status changes for the currently displayed 50-member page; other carried members retain their previous season status.
- `feesOwed` initializes to zero as approved. A fee assessment/due schedule is not included in this phase.
- The current-season marker is administrative and can point at a future-dated season immediately after rollover.
- Confirm local legal requirements before adding member data or retention rules beyond the current app behavior.
