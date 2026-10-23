import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { lockRow } from '@/lib/row-lock'
import { productionsRepository } from './repository'
import type { AssetSchemaInput, CallSheetInput, ProductionCreateInput } from './schema'
import {
  ProductionRuleError,
  validateAssetCheckin,
  validateAssetCheckout,
  validateProductionTransition,
  validateTaskTransition,
} from './rules'

export class ProductionServiceError extends Error {}

function dateAtNairobi(date: string, time = '00:00') {
  return parseNairobiDate(date, time)
}

function mapRule(error: unknown): never {
  if (error instanceof ProductionRuleError) throw new ProductionServiceError(error.message)
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ProductionServiceError('A matching record already exists.')
  }
  throw error
}

async function writableProduction(tx: Prisma.TransactionClient, productionId: string) {
  const production = await productionsRepository.findProduction(tx, productionId)
  if (!production) throw new ProductionServiceError('Production not found.')
  if (production.status === 'COMPLETED' || production.status === 'CANCELLED') {
    throw new ProductionServiceError('This production is closed to changes.')
  }
  return production
}

export async function createProduction(input: ProductionCreateInput, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    const season = await productionsRepository.currentSeason(tx)
    const production = await productionsRepository.createProduction(tx, {
      title: input.title,
      description: input.description,
      startDate: input.startDate ? dateAtNairobi(input.startDate) : null,
      endDate: input.endDate ? dateAtNairobi(input.endDate) : null,
      seasonId: season?.id ?? null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_CREATED', entity: 'Production', entityId: production.id,
      details: { title: production.title, seasonId: season?.id ?? null },
    })
    return production
  })
}

export async function transitionProduction(productionId: string, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED', actorId: string) {
  try {
    return await productionsRepository.transaction(async (tx) => {
      await lockRow(tx, 'Production', productionId)
      const production = await productionsRepository.findProduction(tx, productionId)
      if (!production) throw new ProductionServiceError('Production not found.')
      validateProductionTransition(production.status, status)
      await productionsRepository.updateProductionStatus(tx, productionId, status)
      await writeAuditLog(tx, {
        actorId, action: 'PRODUCTION_STATUS_CHANGED', entity: 'Production', entityId: productionId,
        details: { from: production.status, to: status },
      })
      return { status }
    })
  } catch (error) {
    mapRule(error)
  }
}

export async function addScriptVersion(input: {
  productionId: string; version: string; usageRightsNotes: string; storageReference: string
}, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    const script = await productionsRepository.createScriptVersion(tx, { ...input, createdById: actorId })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_SCRIPT_VERSION_ADDED', entity: 'ScriptVersion', entityId: script.id,
      details: { productionId: input.productionId, version: input.version },
    })
    return script
  }).catch(mapRule)
}

export async function addProductionRole(input: { productionId: string; name: string; description: string }, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    const role = await productionsRepository.createRole(tx, input)
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_ROLE_CREATED', entity: 'ProductionRole', entityId: role.id,
      details: { productionId: input.productionId, name: input.name },
    })
    return role
  }).catch(mapRule)
}

export async function assignCasting(input: {
  productionId: string; roleId: string; memberId: string; type: 'CAST' | 'UNDERSTUDY'
}, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    if (!await productionsRepository.findRole(tx, input.productionId, input.roleId)) throw new ProductionServiceError('Choose a role in this production.')
    if (!await productionsRepository.isCurrentActiveMember(tx, input.memberId)) throw new ProductionServiceError('Choose an active member in the current season.')
    const casting = await productionsRepository.createCasting(tx, input)
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_CASTING_ASSIGNED', entity: 'Casting', entityId: casting.id,
      details: { productionId: input.productionId, roleId: input.roleId, memberId: input.memberId, type: input.type },
    })
    return casting
  }).catch(mapRule)
}

export async function assignCrew(input: { productionId: string; memberId: string; assignment: string }, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    if (!await productionsRepository.isCurrentActiveMember(tx, input.memberId)) throw new ProductionServiceError('Choose an active member in the current season.')
    const crew = await productionsRepository.createCrewAssignment(tx, input)
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_CREW_ASSIGNED', entity: 'CrewAssignment', entityId: crew.id,
      details: { productionId: input.productionId, memberId: input.memberId, assignment: input.assignment },
    })
    return crew
  }).catch(mapRule)
}

export async function createProductionTask(input: {
  productionId: string; title: string; description: string; ownerMemberId: string; deadline: string | null
}, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    if (input.ownerMemberId && !await productionsRepository.isCurrentActiveMember(tx, input.ownerMemberId)) {
      throw new ProductionServiceError('Choose an active member in the current season as owner.')
    }
    const task = await productionsRepository.createTask(tx, {
      ...input,
      ownerMemberId: input.ownerMemberId || null,
      deadline: input.deadline ? dateAtNairobi(input.deadline) : null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_TASK_CREATED', entity: 'ProductionTask', entityId: task.id,
      details: { productionId: input.productionId, ownerMemberId: input.ownerMemberId || null },
    })
    return task
  }).catch(mapRule)
}

export async function updateProductionTaskStatus(
  productionId: string,
  taskId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  actorId: string,
) {
  try {
    return await productionsRepository.transaction(async (tx) => {
      await writableProduction(tx, productionId)
      await lockRow(tx, 'ProductionTask', taskId)
      const task = await productionsRepository.findTask(tx, productionId, taskId)
      if (!task) throw new ProductionServiceError('Task not found.')
      validateTaskTransition(task.status, status)
      await productionsRepository.updateTaskStatus(tx, task.id, status)
      await writeAuditLog(tx, {
        actorId, action: 'PRODUCTION_TASK_STATUS_CHANGED', entity: 'ProductionTask', entityId: task.id,
        details: { productionId, from: task.status, to: status },
      })
      return { status }
    })
  } catch (error) {
    mapRule(error)
  }
}

export async function scheduleShow(input: {
  productionId: string; date: string; startTime: string; venue: string
}, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    const show = await productionsRepository.createShowDate(tx, {
      productionId: input.productionId,
      startsAt: dateAtNairobi(input.date, input.startTime),
      venue: input.venue,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_SHOW_SCHEDULED', entity: 'ShowDate', entityId: show.id,
      details: { productionId: input.productionId, startsAt: show.startsAt.toISOString(), venue: input.venue },
    })
    return show
  }).catch(mapRule)
}

export async function createCallSheet(input: CallSheetInput, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await writableProduction(tx, input.productionId)
    if (!await productionsRepository.findShowDate(tx, input.productionId, input.showDateId)) {
      throw new ProductionServiceError('Choose a show date in this production.')
    }
    const eligible = await productionsRepository.eligibleMembers(tx, input.memberIds)
    if (eligible.length !== input.memberIds.length) throw new ProductionServiceError('Call sheets can include only active members in the current season.')
    const callSheet = await productionsRepository.createCallSheet(tx, {
      ...input,
      callAt: dateAtNairobi(input.callDate, input.callTime),
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_CALL_SHEET_CREATED', entity: 'CallSheet', entityId: callSheet.id,
      details: { productionId: input.productionId, showDateId: input.showDateId, calledMemberCount: input.memberIds.length },
    })
    return callSheet
  }).catch(mapRule)
}

export async function createAsset(input: AssetSchemaInput, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    if (input.productionId) await writableProduction(tx, input.productionId)
    const asset = await productionsRepository.createAsset(tx, {
      ...input, productionId: input.productionId || null, updatedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_ASSET_CREATED', entity: 'Asset', entityId: asset.id,
      details: { productionId: input.productionId || null, category: input.category, condition: input.condition },
    })
    return asset
  }).catch(mapRule)
}

export async function checkoutAsset(assetId: string, memberId: string, actorId: string) {
  try {
    return await productionsRepository.transaction(async (tx) => {
      await lockRow(tx, 'Asset', assetId)
      const asset = await productionsRepository.findAsset(tx, assetId)
      if (!asset) throw new ProductionServiceError('Asset not found.')
      validateAssetCheckout(asset.status)
      if (!await productionsRepository.isCurrentActiveMember(tx, memberId)) throw new ProductionServiceError('Choose an active member in the current season.')
      await productionsRepository.moveAsset(tx, asset.id, { status: 'CHECKED_OUT', currentHolderMemberId: memberId, updatedById: actorId })
      await writeAuditLog(tx, {
        actorId, action: 'PRODUCTION_ASSET_CHECKED_OUT', entity: 'Asset', entityId: asset.id,
        details: { memberId },
      })
      return { assetId: asset.id }
    })
  } catch (error) {
    mapRule(error)
  }
}

export async function checkinAsset(assetId: string, actorId: string) {
  try {
    return await productionsRepository.transaction(async (tx) => {
      await lockRow(tx, 'Asset', assetId)
      const asset = await productionsRepository.findAsset(tx, assetId)
      if (!asset) throw new ProductionServiceError('Asset not found.')
      validateAssetCheckin(asset.status)
      await productionsRepository.moveAsset(tx, asset.id, { status: 'AVAILABLE', currentHolderMemberId: null, updatedById: actorId })
      await writeAuditLog(tx, {
        actorId, action: 'PRODUCTION_ASSET_CHECKED_IN', entity: 'Asset', entityId: asset.id,
        details: { previousHolderMemberId: asset.currentHolderMemberId },
      })
      return { assetId: asset.id }
    })
  } catch (error) {
    mapRule(error)
  }
}

export async function addPostShowNote(input: {
  productionId: string; showDateId: string; note: string
}, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    const production = await productionsRepository.findProduction(tx, input.productionId)
    if (!production || production.status === 'CANCELLED') throw new ProductionServiceError('Production not found or cancelled.')
    if (input.showDateId && !await productionsRepository.findShowDate(tx, input.productionId, input.showDateId)) {
      throw new ProductionServiceError('Choose a show date in this production.')
    }
    const note = await productionsRepository.createPostShowNote(tx, {
      ...input,
      showDateId: input.showDateId || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId, action: 'PRODUCTION_POST_SHOW_NOTE_ADDED', entity: 'PostShowNote', entityId: note.id,
      details: { productionId: input.productionId, showDateId: input.showDateId || null },
    })
    return note
  }).catch(mapRule)
}
