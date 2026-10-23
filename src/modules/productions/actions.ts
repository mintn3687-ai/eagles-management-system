'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  assetMovementSchema,
  assetSchema,
  callSheetSchema,
  castingSchema,
  crewSchema,
  postShowNoteSchema,
  productionCreateSchema,
  productionStatusSchema,
  rehearsalLinkSchema,
  roleSchema,
  scriptVersionSchema,
  showDateSchema,
  taskSchema,
  taskStatusSchema,
} from './schema'
import {
  addPostShowNote,
  addProductionRole,
  addScriptVersion,
  assignCasting,
  assignCrew,
  checkinAsset,
  checkoutAsset,
  createAsset,
  createCallSheet,
  createProduction,
  createProductionTask,
  ProductionServiceError,
  scheduleShow,
  transitionProduction,
  updateProductionTaskStatus,
} from './service'
import { linkRehearsal } from './rehearsal-link-service'

export type ProductionActionState = { success?: boolean; message?: string; error?: string }

function value(form: FormData, key: string) {
  const result = form.get(key)
  return typeof result === 'string' ? result : ''
}

function values(form: FormData, key: string) {
  return form.getAll(key).filter((result): result is string => typeof result === 'string')
}

function actionError(error: unknown): ProductionActionState {
  if (error instanceof ProductionServiceError || error instanceof AccessError) return { error: error.message }
  return { error: 'Could not save the production change. Please try again.' }
}

function refresh(productionId?: string) {
  revalidatePath('/admin/productions')
  revalidatePath('/member/productions')
  if (productionId) revalidatePath(`/admin/productions/${productionId}`)
}

export async function createProductionAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = productionCreateSchema.safeParse({
      title: value(form, 'title'), description: value(form, 'description'),
      startDate: value(form, 'startDate'), endDate: value(form, 'endDate'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the production details.' }
    const production = await createProduction(parsed.data, actor.id)
    refresh(production.id)
    return { success: true, message: `Production “${production.title}” created.` }
  } catch (error) { return actionError(error) }
}

export async function productionStatusAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = productionStatusSchema.safeParse({ productionId: value(form, 'productionId'), status: value(form, 'status') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a production status.' }
    await transitionProduction(parsed.data.productionId, parsed.data.status, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Production status updated.' }
  } catch (error) { return actionError(error) }
}

export async function addScriptVersionAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = scriptVersionSchema.safeParse({
      productionId: value(form, 'productionId'), version: value(form, 'version'),
      usageRightsNotes: value(form, 'usageRightsNotes'), storageReference: value(form, 'storageReference'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check script details.' }
    await addScriptVersion(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Script version recorded.' }
  } catch (error) { return actionError(error) }
}

export async function addProductionRoleAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = roleSchema.safeParse({
      productionId: value(form, 'productionId'), name: value(form, 'name'), description: value(form, 'description'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check role details.' }
    await addProductionRole(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Role added.' }
  } catch (error) { return actionError(error) }
}

export async function assignCastingAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = castingSchema.safeParse({
      productionId: value(form, 'productionId'), roleId: value(form, 'roleId'),
      memberId: value(form, 'memberId'), type: value(form, 'type'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check casting details.' }
    await assignCasting(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Casting assignment saved.' }
  } catch (error) { return actionError(error) }
}

export async function assignCrewAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = crewSchema.safeParse({
      productionId: value(form, 'productionId'), memberId: value(form, 'memberId'), assignment: value(form, 'assignment'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check crew assignment.' }
    await assignCrew(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Crew assignment saved.' }
  } catch (error) { return actionError(error) }
}

export async function createProductionTaskAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = taskSchema.safeParse({
      productionId: value(form, 'productionId'), title: value(form, 'title'),
      description: value(form, 'description'), ownerMemberId: value(form, 'ownerMemberId'),
      deadline: value(form, 'deadline'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check task details.' }
    await createProductionTask(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Production task created.' }
  } catch (error) { return actionError(error) }
}

export async function productionTaskStatusAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = taskStatusSchema.safeParse({
      productionId: value(form, 'productionId'), taskId: value(form, 'taskId'), status: value(form, 'status'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a task status.' }
    await updateProductionTaskStatus(parsed.data.productionId, parsed.data.taskId, parsed.data.status, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Task status updated.' }
  } catch (error) { return actionError(error) }
}

export async function scheduleShowAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = showDateSchema.safeParse({
      productionId: value(form, 'productionId'), date: value(form, 'date'),
      startTime: value(form, 'startTime'), venue: value(form, 'venue'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check show details.' }
    await scheduleShow(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Show date scheduled.' }
  } catch (error) { return actionError(error) }
}

export async function createCallSheetAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = callSheetSchema.safeParse({
      productionId: value(form, 'productionId'), showDateId: value(form, 'showDateId'),
      title: value(form, 'title'), callDate: value(form, 'callDate'), callTime: value(form, 'callTime'),
      notes: value(form, 'notes'), memberIds: values(form, 'memberIds'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check call sheet.' }
    await createCallSheet(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Call sheet published to the selected members.' }
  } catch (error) { return actionError(error) }
}

export async function createAssetAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = assetSchema.safeParse({
      productionId: value(form, 'productionId'), name: value(form, 'name'),
      category: value(form, 'category'), condition: value(form, 'condition'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check asset details.' }
    await createAsset(parsed.data, actor.id)
    refresh(parsed.data.productionId || undefined)
    return { success: true, message: 'Asset added to the register.' }
  } catch (error) { return actionError(error) }
}

export async function checkoutAssetAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = assetMovementSchema.safeParse({ assetId: value(form, 'assetId'), memberId: value(form, 'memberId') })
    if (!parsed.success || !parsed.data.memberId) return { error: parsed.success ? 'Choose a member to hold the asset.' : parsed.error.issues[0]?.message }
    await checkoutAsset(parsed.data.assetId, parsed.data.memberId, actor.id)
    refresh()
    return { success: true, message: 'Asset checked out.' }
  } catch (error) { return actionError(error) }
}

export async function checkinAssetAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = assetMovementSchema.pick({ assetId: true }).safeParse({ assetId: value(form, 'assetId') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose an asset.' }
    await checkinAsset(parsed.data.assetId, actor.id)
    refresh()
    return { success: true, message: 'Asset checked in.' }
  } catch (error) { return actionError(error) }
}

export async function addPostShowNoteAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = postShowNoteSchema.safeParse({
      productionId: value(form, 'productionId'), showDateId: value(form, 'showDateId'), note: value(form, 'note'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the post-show note.' }
    await addPostShowNote(parsed.data, actor.id)
    refresh(parsed.data.productionId)
    return { success: true, message: 'Post-show note saved.' }
  } catch (error) { return actionError(error) }
}

export async function linkRehearsalAction(_state: ProductionActionState, form: FormData): Promise<ProductionActionState> {
  try {
    const actor = await requirePermission('productions:manage')
    const parsed = rehearsalLinkSchema.safeParse({
      productionId: value(form, 'productionId'), rehearsalId: value(form, 'rehearsalId'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Choose a rehearsal.' }
    await linkRehearsal(parsed.data, actor.id)
    refresh(parsed.data.productionId || undefined)
    revalidatePath('/admin/rehearsals')
    return { success: true, message: 'Rehearsal linked.' }
  } catch (error) { return actionError(error) }
}
