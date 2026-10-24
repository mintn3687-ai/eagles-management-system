import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { festivalsRepository } from './repository'
import { canTransitionEntry, summarizeFestivalBudget } from './rules'
import type { FestivalEntryStatus } from './rules'
import type {
  EntryCategoryInput,
  EntryCategoryUpdateInput,
  FestivalBudgetItemInput,
  FestivalCreateInput,
  FestivalEntryCreateInput,
  FestivalInvitationCreateInput,
  FestivalFinanceLinkInput,
  FestivalFinanceUnlinkInput,
  FestivalUpdateInput,
} from './schema'

export class FestivalServiceError extends Error {}

function mapError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new FestivalServiceError('Festival not found.')
  }
  throw error
}

function mapCategoryError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new FestivalServiceError('A category with this name already exists for the festival.')
  }
  throw error
}

function mapFinanceLinkError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new FestivalServiceError('This finance entry is already linked to a festival budget item.')
  }
  throw error
}

function dateAtNairobi(date: string | null) {
  return date ? parseNairobiDate(date) : null
}

function dateFields(input: { startDate: string | null; endDate: string | null }) {
  return {
    startDate: dateAtNairobi(input.startDate),
    endDate: dateAtNairobi(input.endDate),
  }
}

export async function listFestivals() {
  return festivalsRepository.list()
}

export async function getFestival(festivalId: string) {
  return festivalsRepository.find(festivalId)
}

export async function createFestival(input: FestivalCreateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const festival = await festivalsRepository.create(tx, {
      name: input.name,
      year: input.year,
      organizer: input.organizer || null,
      venue: input.venue || null,
      ...dateFields(input),
      notes: input.notes || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_CREATED',
      entity: 'Festival',
      entityId: festival.id,
      details: { name: festival.name, year: festival.year },
    })
    return festival
  }).catch(mapError)
}

export async function updateFestival(input: FestivalUpdateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const previous = await festivalsRepository.findForUpdate(tx, input.festivalId)
    if (!previous) throw new FestivalServiceError('Festival not found.')

    const festival = await festivalsRepository.update(tx, input.festivalId, {
      name: input.name,
      year: input.year,
      organizer: input.organizer || null,
      venue: input.venue || null,
      ...dateFields(input),
      status: input.status,
      notes: input.notes || null,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_UPDATED',
      entity: 'Festival',
      entityId: festival.id,
      details: {
        from: { name: previous.name, year: previous.year, status: previous.status },
        to: { name: festival.name, year: festival.year, status: festival.status },
      },
    })
    return festival
  }).catch(mapError)
}

export async function createFestivalInvitation(input: FestivalInvitationCreateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    if (!await festivalsRepository.festivalExists(tx, input.festivalId)) {
      throw new FestivalServiceError('Festival not found.')
    }
    const invitation = await festivalsRepository.createInvitation(tx, {
      festivalId: input.festivalId,
      receivedAt: parseNairobiDate(input.receivedAt),
      responseDeadline: dateAtNairobi(input.responseDeadline),
      notes: input.notes || null,
      recordedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_INVITATION_RECORDED',
      entity: 'FestivalInvitation',
      entityId: invitation.id,
      details: { festivalId: input.festivalId, responseDeadline: input.responseDeadline },
    })
    return invitation
  }).catch(mapError)
}

export async function updateFestivalInvitationStatus(
  festivalId: string,
  invitationId: string,
  status: 'ACCEPTED' | 'DECLINED',
  actorId: string,
) {
  return festivalsRepository.transaction(async (tx) => {
    const invitation = await festivalsRepository.findInvitation(tx, festivalId, invitationId)
    if (!invitation) throw new FestivalServiceError('Invitation not found for this festival.')
    if (invitation.status !== 'RECEIVED') throw new FestivalServiceError('This invitation has already been answered.')
    const respondedAt = new Date()
    const updated = await festivalsRepository.transitionInvitation(tx, festivalId, invitationId, {
      status,
      respondedAt,
    })
    if (!updated.count) throw new FestivalServiceError('This invitation has already been answered.')
    await writeAuditLog(tx, {
      actorId,
      action: `FESTIVAL_INVITATION_${status}`,
      entity: 'FestivalInvitation',
      entityId: invitationId,
      details: { festivalId },
    })
    return { status, respondedAt }
  }).catch(mapError)
}

export async function createFestivalCategory(input: EntryCategoryInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    if (!await festivalsRepository.festivalExists(tx, input.festivalId)) {
      throw new FestivalServiceError('Festival not found.')
    }
    const category = await festivalsRepository.createCategory(tx, {
      festivalId: input.festivalId,
      name: input.name,
      defaultDeadline: dateAtNairobi(input.defaultDeadline),
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_ENTRY_CATEGORY_CREATED',
      entity: 'FestivalEntryCategory',
      entityId: category.id,
      details: { festivalId: input.festivalId, name: input.name },
    })
    return category
  }).catch(mapCategoryError)
}

export async function updateFestivalCategory(input: EntryCategoryUpdateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const category = await festivalsRepository.findCategory(tx, input.festivalId, input.categoryId)
    if (!category) throw new FestivalServiceError('Category not found for this festival.')
    const updated = await festivalsRepository.updateCategory(tx, input.categoryId, {
      name: input.name,
      defaultDeadline: dateAtNairobi(input.defaultDeadline),
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_ENTRY_CATEGORY_UPDATED',
      entity: 'FestivalEntryCategory',
      entityId: updated.id,
      details: { festivalId: input.festivalId, from: category.name, to: updated.name },
    })
    return updated
  }).catch(mapError)
}

export async function createFestivalEntry(input: FestivalEntryCreateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    if (!await festivalsRepository.festivalExists(tx, input.festivalId)) {
      throw new FestivalServiceError('Festival not found.')
    }
    const category = await festivalsRepository.categoryForFestival(tx, input.festivalId, input.categoryId)
    if (!category) throw new FestivalServiceError('Choose a category configured for this festival.')
    if (input.productionId && !await festivalsRepository.productionExists(tx, input.productionId)) {
      throw new FestivalServiceError('Choose a valid production.')
    }
    const deadline = input.deadline ? dateAtNairobi(input.deadline) : category.defaultDeadline
    const entry = await festivalsRepository.createEntry(tx, {
      festivalId: input.festivalId,
      categoryId: category.id,
      productionId: input.productionId || null,
      itemTitle: input.itemTitle,
      status: 'PENDING',
      deadline,
      notes: input.notes || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_ENTRY_CREATED',
      entity: 'FestivalEntry',
      entityId: entry.id,
      details: { festivalId: input.festivalId, categoryId: category.id, productionId: input.productionId || null },
    })
    return entry
  }).catch(mapError)
}

export async function updateFestivalEntryStatus(
  festivalId: string,
  entryId: string,
  status: FestivalEntryStatus,
  actorId: string,
) {
  return festivalsRepository.transaction(async (tx) => {
    const entry = await festivalsRepository.findEntry(tx, festivalId, entryId)
    if (!entry) throw new FestivalServiceError('Entry not found for this festival.')
    if (!canTransitionEntry(entry.status, status)) {
      throw new FestivalServiceError(`An entry cannot move from ${entry.status.toLowerCase()} to ${status.toLowerCase()}.`)
    }
    const changedAt = new Date()
    const updated = await festivalsRepository.transitionEntry(tx, festivalId, entryId, entry.status, {
      status,
      ...(status === 'SUBMITTED' ? { submittedAt: changedAt } : {}),
      ...(status === 'CONFIRMED' ? { confirmedAt: changedAt } : {}),
    })
    if (!updated.count) throw new FestivalServiceError('This entry has already changed status.')
    await writeAuditLog(tx, {
      actorId,
      action: `FESTIVAL_ENTRY_${status}`,
      entity: 'FestivalEntry',
      entityId: entryId,
      details: { festivalId, from: entry.status, to: status },
    })
    return { status, changedAt }
  }).catch(mapError)
}

export async function getFestivalPlanning(festivalId: string) {
  const planning = await festivalsRepository.planningData(festivalId)
  return {
    ...planning,
    budgetSummary: summarizeFestivalBudget(planning.budgetItems),
  }
}

export async function createFestivalBudgetItem(input: FestivalBudgetItemInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    if (!await festivalsRepository.festivalExists(tx, input.festivalId)) {
      throw new FestivalServiceError('Festival not found.')
    }
    const item = await festivalsRepository.createBudgetItem(tx, {
      festivalId: input.festivalId,
      type: input.type,
      category: input.category,
      plannedAmount: input.plannedAmount,
      notes: input.notes || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_BUDGET_ITEM_CREATED',
      entity: 'FestivalBudgetItem',
      entityId: item.id,
      details: { festivalId: input.festivalId, type: item.type, category: item.category, plannedAmount: item.plannedAmount },
    })
    return item
  }).catch(mapError)
}

export async function linkFestivalFinanceEntry(input: FestivalFinanceLinkInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const item = await festivalsRepository.findBudgetItem(tx, input.festivalId, input.budgetItemId)
    if (!item) throw new FestivalServiceError('Budget item not found for this festival.')
    const financeEntry = await festivalsRepository.findFinanceEntry(tx, input.financeEntryId)
    if (!financeEntry) throw new FestivalServiceError('Finance entry not found.')
    if (financeEntry.type !== item.type) {
      throw new FestivalServiceError(`Link an ${item.type.toLowerCase()} finance entry to this budget item.`)
    }
    if (await festivalsRepository.findFinanceLinkByEntry(tx, financeEntry.id)) {
      throw new FestivalServiceError('This finance entry is already linked to a festival budget item.')
    }
    const link = await festivalsRepository.createFinanceLink(tx, {
      festivalId: input.festivalId,
      budgetItemId: item.id,
      financeEntryId: financeEntry.id,
      linkedById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_FINANCE_ENTRY_LINKED',
      entity: 'FestivalFinanceLink',
      entityId: link.id,
      details: {
        festivalId: input.festivalId,
        budgetItemId: item.id,
        financeEntryId: financeEntry.id,
        amount: financeEntry.amount,
        type: financeEntry.type,
      },
    })
    return link
  }).catch(mapFinanceLinkError)
}

export async function unlinkFestivalFinanceEntry(input: FestivalFinanceUnlinkInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const link = await festivalsRepository.findFinanceLink(tx, input.festivalId, input.linkId)
    if (!link) throw new FestivalServiceError('Finance link not found for this festival.')
    const financeEntry = await festivalsRepository.findFinanceEntry(tx, link.financeEntryId)
    if (!financeEntry) throw new FestivalServiceError('Linked finance entry no longer exists.')
    const removed = await festivalsRepository.deleteFinanceLink(tx, input.festivalId, link.id)
    if (!removed.count) throw new FestivalServiceError('This finance link has already been removed.')
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_FINANCE_ENTRY_UNLINKED',
      entity: 'FestivalFinanceLink',
      entityId: link.id,
      details: {
        festivalId: input.festivalId,
        budgetItemId: link.budgetItemId,
        financeEntryId: link.financeEntryId,
        amount: financeEntry.amount,
        type: financeEntry.type,
      },
    })
    return { unlinked: true }
  }).catch(mapError)
}
