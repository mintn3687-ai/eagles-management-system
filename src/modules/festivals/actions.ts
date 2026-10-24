'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  entryCategorySchema,
  entryCategoryUpdateSchema,
  festivalApprovalDecisionSchema,
  festivalBudgetApprovalSubmitSchema,
  festivalBudgetItemUpdateSchema,
  festivalCreateSchema,
  festivalBudgetItemSchema,
  festivalEntryCreateSchema,
  festivalFinanceLinkSchema,
  festivalFinanceUnlinkSchema,
  festivalPlanApprovalSubmitSchema,
  festivalEntryStatusSchema,
  invitationCreateSchema,
  invitationStatusSchema,
  festivalUpdateSchema,
} from './schema'
import {
  createFestivalCategory,
  createFestivalEntry,
  createFestivalInvitation,
  createFestivalBudgetItem,
  createFestival,
  decideFestivalApproval,
  FestivalServiceError,
  linkFestivalFinanceEntry,
  unlinkFestivalFinanceEntry,
  submitFestivalBudgetApproval,
  submitFestivalPlanApproval,
  updateFestivalEntryStatus,
  updateFestivalCategory,
  updateFestivalInvitationStatus,
  updateFestival,
  updateFestivalBudgetItem,
} from './service'

export type FestivalActionState = { success?: boolean; message?: string; error?: string }

function value(form: FormData, key: string) {
  const item = form.get(key)
  return typeof item === 'string' ? item : ''
}

function parseYear(form: FormData) {
  const raw = value(form, 'year').trim()
  return raw ? Number(raw) : Number.NaN
}

function actionError(error: unknown): FestivalActionState {
  if (error instanceof AccessError || error instanceof FestivalServiceError) return { error: error.message }
  throw error
}

function refresh(festivalId?: string) {
  revalidatePath('/admin/festivals')
  if (festivalId) revalidatePath(`/admin/festivals/${festivalId}`)
}

async function financeActor() {
  const actor = await requirePermission('festivals:manage')
  await requirePermission('finance:manage')
  return actor
}

export async function createFestivalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalCreateSchema.safeParse({
      name: value(form, 'name'),
      year: parseYear(form),
      organizer: value(form, 'organizer'),
      venue: value(form, 'venue'),
      startDate: value(form, 'startDate'),
      endDate: value(form, 'endDate'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the festival details.' }
    const festival = await createFestival(parsed.data, actor.id)
    refresh(festival.id)
    return { success: true, message: `Festival “${festival.name}” created.` }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalUpdateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      name: value(form, 'name'),
      year: parseYear(form),
      organizer: value(form, 'organizer'),
      venue: value(form, 'venue'),
      startDate: value(form, 'startDate'),
      endDate: value(form, 'endDate'),
      status: value(form, 'status'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the festival details.' }
    const result = await updateFestival(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return {
      success: true,
      message: result.planResubmitted
        ? 'Festival details updated and the plan was returned for approval.'
        : 'Festival details updated.',
    }
  } catch (error) {
    return actionError(error)
  }
}

export async function createFestivalInvitationAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = invitationCreateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      receivedAt: value(form, 'receivedAt'),
      responseDeadline: value(form, 'responseDeadline'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check invitation details.' }
    await createFestivalInvitation(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival invitation recorded.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalInvitationStatusAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = invitationStatusSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      invitationId: value(form, 'invitationId'),
      status: value(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose an invitation response.' }
    await updateFestivalInvitationStatus(parsed.data.festivalId, parsed.data.invitationId, parsed.data.status, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Invitation response saved.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function createFestivalCategoryAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = entryCategorySchema.safeParse({
      festivalId: value(form, 'festivalId'),
      name: value(form, 'name'),
      defaultDeadline: value(form, 'defaultDeadline'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check category details.' }
    await createFestivalCategory(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival category added.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalCategoryAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = entryCategoryUpdateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      categoryId: value(form, 'categoryId'),
      name: value(form, 'name'),
      defaultDeadline: value(form, 'defaultDeadline'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check category details.' }
    await updateFestivalCategory(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival category updated.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function createFestivalEntryAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalEntryCreateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      categoryId: value(form, 'categoryId'),
      productionId: value(form, 'productionId'),
      itemTitle: value(form, 'itemTitle'),
      deadline: value(form, 'deadline'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check entry details.' }
    await createFestivalEntry(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival entry created.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalEntryStatusAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalEntryStatusSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      entryId: value(form, 'entryId'),
      status: value(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose an entry status.' }
    await updateFestivalEntryStatus(parsed.data.festivalId, parsed.data.entryId, parsed.data.status, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival entry status updated.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function createFestivalBudgetItemAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await financeActor()
    const rawAmount = value(form, 'plannedAmount').trim()
    const parsed = festivalBudgetItemSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      type: value(form, 'type'),
      category: value(form, 'category'),
      plannedAmount: rawAmount ? Number(rawAmount) : Number.NaN,
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check budget details.' }
    await createFestivalBudgetItem(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival budget item created.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalBudgetItemAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await financeActor()
    const rawAmount = value(form, 'plannedAmount').trim()
    const parsed = festivalBudgetItemUpdateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      budgetItemId: value(form, 'budgetItemId'),
      type: value(form, 'type'),
      category: value(form, 'category'),
      plannedAmount: rawAmount ? Number(rawAmount) : Number.NaN,
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check budget details.' }
    const result = await updateFestivalBudgetItem(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return {
      success: true,
      message: !result.updated
        ? 'No budget item changes to save.'
        : result.approvalResubmitted
          ? 'Budget item updated and sent for approval again.'
          : 'Budget item updated.',
    }
  } catch (error) {
    return actionError(error)
  }
}

export async function submitFestivalPlanApprovalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:approve')
    const parsed = festivalPlanApprovalSubmitSchema.safeParse({ festivalId: value(form, 'festivalId') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a festival plan.' }
    await submitFestivalPlanApproval(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival plan submitted for approval.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function submitFestivalBudgetApprovalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await financeActor()
    const parsed = festivalBudgetApprovalSubmitSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      budgetItemId: value(form, 'budgetItemId'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a budget item.' }
    await submitFestivalBudgetApproval(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Budget item submitted for approval.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function decideFestivalApprovalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:approve')
    await requirePermission('finance:manage')
    const rawApprovedAmount = value(form, 'approvedAmount').trim()
    const parsed = festivalApprovalDecisionSchema.safeParse({
      approvalId: value(form, 'approvalId'),
      decision: value(form, 'decision'),
      approvedAmount: rawApprovedAmount ? Number(rawApprovedAmount) : null,
      reason: value(form, 'reason'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the approval decision.' }
    const result = await decideFestivalApproval(parsed.data, actor.id)
    refresh()
    return { success: true, message: `Request ${result.status.toLowerCase()}.` }
  } catch (error) {
    return actionError(error)
  }
}

export async function linkFestivalFinanceEntryAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await financeActor()
    const parsed = festivalFinanceLinkSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      budgetItemId: value(form, 'budgetItemId'),
      financeEntryId: value(form, 'financeEntryId'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a budget item and finance entry.' }
    await linkFestivalFinanceEntry(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Existing finance entry linked to the festival budget.' }
  } catch (error) {
    return actionError(error)
  }
}

export async function unlinkFestivalFinanceEntryAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await financeActor()
    const parsed = festivalFinanceUnlinkSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      linkId: value(form, 'linkId'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a finance link.' }
    await unlinkFestivalFinanceEntry(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Finance link removed; the original ledger entry is unchanged.' }
  } catch (error) {
    return actionError(error)
  }
}
