'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  actionItemSchema,
  actionItemStatusSchema,
  agendaItemSchema,
  attendanceUpdateSchema,
  meetingCreateSchema,
  meetingIdSchema,
  meetingStatusSchema,
  minutesSchema,
  motionDecisionSchema,
  motionSchema,
} from './schema'
import {
  addAgendaItem,
  addMeetingActionItem,
  addMotion,
  approveMeetingMinutes,
  decideMotion,
  MeetingServiceError,
  saveMeetingMinutes,
  transitionMeeting,
  updateMeetingAttendance,
  updateMeetingActionItemStatus,
} from './service'
import { createMeeting } from './creation-service'

export type MeetingActionState = { success?: boolean; message?: string; error?: string }

function formText(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function formTexts(form: FormData, key: string) {
  return form.getAll(key).filter((value): value is string => typeof value === 'string')
}

function responseError(error: unknown): MeetingActionState {
  if (error instanceof MeetingServiceError || error instanceof AccessError) return { error: error.message }
  return { error: 'Could not save the meeting change. Please try again.' }
}

function refreshMeeting(meetingId?: string) {
  revalidatePath('/admin/meetings')
  revalidatePath('/member/meetings')
  if (meetingId) revalidatePath(`/admin/meetings/${meetingId}`)
}

export async function createMeetingAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = meetingCreateSchema.safeParse({
      title: formText(form, 'title'),
      meetingDate: formText(form, 'meetingDate'),
      startTime: formText(form, 'startTime'),
      venue: formText(form, 'venue'),
      quorumPercent: formText(form, 'quorumPercent'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the meeting details.' }
    const meeting = await createMeeting(parsed.data, actor.id)
    refreshMeeting(meeting.id)
    return { success: true, message: `Meeting “${meeting.title}” created with a frozen eligible-member register.` }
  } catch (error) {
    return responseError(error)
  }
}

export async function transitionMeetingAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = meetingStatusSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      status: formText(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a valid meeting status.' }
    await transitionMeeting(parsed.data.meetingId, parsed.data.status, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Meeting status updated.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function addAgendaItemAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = agendaItemSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      title: formText(form, 'title'),
      description: formText(form, 'description'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the agenda item.' }
    await addAgendaItem(parsed.data.meetingId, parsed.data, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Agenda item added.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function updateMeetingAttendanceAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = attendanceUpdateSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      presentMemberIds: formTexts(form, 'presentMemberIds'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the attendance register.' }
    const quorum = await updateMeetingAttendance(parsed.data.meetingId, parsed.data.presentMemberIds, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return {
      success: true,
      message: `Attendance saved: ${quorum.attendedCount}/${quorum.eligibleCount}; quorum ${quorum.hasQuorum ? 'reached' : `not reached (requires ${quorum.requiredCount})`}.`,
    }
  } catch (error) {
    return responseError(error)
  }
}

export async function saveMeetingMinutesAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = minutesSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      minutes: formText(form, 'minutes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Add the meeting minutes.' }
    await saveMeetingMinutes(parsed.data.meetingId, parsed.data.minutes, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Draft minutes saved.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function approveMeetingMinutesAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = meetingIdSchema.safeParse({ meetingId: formText(form, 'meetingId') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a valid meeting.' }
    await approveMeetingMinutes(parsed.data.meetingId, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Minutes approved and published to members.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function addMotionAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = motionSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      title: formText(form, 'title'),
      description: formText(form, 'description'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the motion.' }
    await addMotion(parsed.data.meetingId, parsed.data, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Motion added.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function decideMotionAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = motionDecisionSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      motionId: formText(form, 'motionId'),
      status: formText(form, 'status'),
      decisionNote: formText(form, 'decisionNote'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a motion decision.' }
    const { meetingId, motionId, ...decision } = parsed.data
    await decideMotion(meetingId, motionId, decision, actor.id)
    refreshMeeting(meetingId)
    return { success: true, message: 'Motion decision recorded.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function addMeetingActionItemAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = actionItemSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      title: formText(form, 'title'),
      description: formText(form, 'description'),
      ownerMemberId: formText(form, 'ownerMemberId'),
      dueDate: formText(form, 'dueDate'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the action item.' }
    await addMeetingActionItem(parsed.data.meetingId, parsed.data, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Action item assigned.' }
  } catch (error) {
    return responseError(error)
  }
}

export async function updateMeetingActionItemStatusAction(_state: MeetingActionState, form: FormData): Promise<MeetingActionState> {
  try {
    const actor = await requirePermission('meetings:manage')
    const parsed = actionItemStatusSchema.safeParse({
      meetingId: formText(form, 'meetingId'),
      actionItemId: formText(form, 'actionItemId'),
      status: formText(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose an action-item status.' }
    await updateMeetingActionItemStatus(parsed.data.meetingId, parsed.data.actionItemId, parsed.data.status, actor.id)
    refreshMeeting(parsed.data.meetingId)
    return { success: true, message: 'Action-item status updated.' }
  } catch (error) {
    return responseError(error)
  }
}
