# Meetings and Governance

## Access and routes

- `/admin/meetings` — Committee and Super Admin create and list meetings.
- `/admin/meetings/[id]` — Committee and Super Admin manage the agenda, attendance, minutes, motions, and action items.
- `/member/meetings` — authenticated members can view approved minutes and action items assigned to their own member record.

The central `meetings:manage` permission is required for all meeting-management actions. `meetings:read` is used for member governance access. Existing session consent and restricted-account checks still apply. Staff accounts without a linked member record may view approved minutes but have no personal action-item list.

## Data model

- `Meeting` stores title, Nairobi-local meeting instant, venue, lifecycle state, per-meeting quorum percentage, frozen eligible-member count, minutes, and approval actor/time.
- `MeetingAgendaItem` stores ordered agenda topics and optional details.
- `MeetingAttendance` is the frozen register of members active in the current season when the meeting is created, with a presence flag. A unique constraint prevents duplicate attendance rows.
- `Motion` stores proposal text and its pending/approved/rejected/deferred decision, decision note, actor, and timestamp.
- `MeetingActionItem` stores task, optional due date, owner, status, and creator.

All new records have creation/update timestamps, foreign-key indexes, and restrictive foreign keys so history is not deleted through cascade operations. Lifecycle, attendance, approval, motion, and action-item changes are recorded in the audit log in the same transaction.

## Governance rules

1. New meetings start as `DRAFT`; a Committee member or Super Admin schedules them, then completes or cancels them. Invalid or backward transitions are rejected.
2. The eligible list is frozen from `ACTIVE` `SeasonMembership` rows in the current season at meeting creation. Members added later do not silently change the denominator.
3. Quorum is `ceil(eligible member count × configured percentage / 100)`. A meeting with no eligible members cannot reach quorum.
4. Attendance can be updated while scheduled or completed, but not after minutes are approved. Only members in the frozen register can be marked present.
5. Minutes can be saved as draft only after completion. Approval requires non-empty minutes, a completed meeting, and quorum. Approved minutes are immutable and visible to members.
6. Motions can be added to scheduled/completed meetings before minutes approval. Decisions require quorum and are recorded once; a decided motion cannot be decided again.
7. Action items can be assigned only to a member in the frozen attendance register. Committee and Super Admin can move an item from open to in-progress or a terminal completed/cancelled state. Members can view, but cannot edit, their own items.
8. No individual voting or election behavior is implemented in this phase.

## Manual verification

1. Sign in as Committee or Super Admin and open `/admin/meetings`.
2. Create a draft meeting. Verify its eligible register contains the active members from the current season and the selected quorum percentage is shown.
3. Add agenda items, schedule the meeting, mark attendees present, and confirm the quorum count uses the frozen eligible denominator.
4. Add a motion. Verify decision is rejected before quorum, then mark enough attendees and record an approved/rejected/deferred decision.
5. Complete the meeting, save draft minutes, and verify approval is blocked if quorum is not reached. With quorum, approve and publish the minutes.
6. Assign an action item to an eligible member, update its status as committee, and sign in as that member to `/member/meetings`. Verify approved minutes are visible and only that member's task appears.
7. Verify draft minutes and other members' action items are not visible to the member page. Confirm meeting changes appear in `/admin/audit`.

## Limitations

- Eligibility snapshots are taken from the current season at meeting creation; there is no later add/remove attendee workflow.
- Minutes are plain text, not attachments or rich text. Approved minutes cannot be edited; corrections require a later meeting record.
- Member action items are read-only. Committee manages action-item status.
- There is no configurable club-wide quorum default yet; each meeting chooses its own threshold (default 50%).
