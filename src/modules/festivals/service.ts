import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { nairobiDateKey, parseNairobiDate } from '@/lib/dates'
import { festivalsRepository } from './repository'
import {
  canTransitionEntry,
  FestivalApprovalRuleError,
  summarizeFestivalBudget,
  sumLinkedFinanceAmounts,
  validateBudgetApprovalAmount,
} from './rules'
import type { FestivalEntryStatus } from './rules'
import type {
  EntryCategoryInput,
  EntryCategoryUpdateInput,
  FestivalBudgetItemInput,
  FestivalBudgetItemUpdateInput,
  FestivalApprovalDecisionInput,
  FestivalBudgetApprovalSubmitInput,
  FestivalCreateInput,
  FestivalEntryCreateInput,
  FestivalInvitationCreateInput,
  FestivalFinanceLinkInput,
  FestivalFinanceUnlinkInput,
  FestivalLogisticsItemInput,
  FestivalLogisticsItemUpdateInput,
  FestivalLogisticsStatusInput,
  FestivalPlanApprovalSubmitInput,
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

function mapApprovalError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new FestivalServiceError('An approval request already exists for this festival plan or budget item.')
  }
  if (error instanceof FestivalApprovalRuleError) throw new FestivalServiceError(error.message)
  throw error
}

function targetKey(type: 'PLAN' | 'BUDGET', id: string) {
  return `${type}:${id}`
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

export async function getFestivalDashboard(today: string) {
  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + 30)
  const deadlineLimit = parseNairobiDate(horizon.toISOString().slice(0, 10))
  const data = await festivalsRepository.dashboardData(deadlineLimit)
  const festivalById = new Map(data.festivals.map((festival) => [festival.id, festival]))
  const activeFestivals = data.festivals.filter((festival) =>
    festival.status !== 'COMPLETED'
      && festival.status !== 'CANCELLED'
      && (
        !festival.startDate
        || nairobiDateKey(festival.startDate) >= today
        || Boolean(festival.endDate && nairobiDateKey(festival.endDate) >= today)
      ),
  )
  const upcomingFestivals = activeFestivals.slice(0, 8)
  const financeAmounts = new Map(data.financeEntries.map((entry) => [entry.id, entry.amount]))
  const linkedAmounts = new Map<string, number[]>()
  for (const link of data.financeLinks) {
    const amount = financeAmounts.get(link.financeEntryId)
    if (amount !== undefined) {
      const amounts = linkedAmounts.get(link.budgetItemId) ?? []
      amounts.push(amount)
      linkedAmounts.set(link.budgetItemId, amounts)
    }
  }
  const approvedAmounts = new Map<string, number>()
  for (const approval of data.approvals) {
    if (approval.type === 'BUDGET' && approval.status === 'APPROVED' && approval.budgetItemId && approval.approvedAmount !== null) {
      approvedAmounts.set(approval.budgetItemId, approval.approvedAmount)
    }
  }
  const entryCounts = new Map<string, Record<string, number>>()
  for (const group of data.entryCounts) {
    const counts = entryCounts.get(group.festivalId) ?? {}
    counts[group.status] = group._count._all
    entryCounts.set(group.festivalId, counts)
  }
  const logisticsCounts = new Map<string, number>()
  for (const group of data.logisticsCounts) {
    if (group.status === 'OPEN' || group.status === 'IN_PROGRESS') {
      logisticsCounts.set(group.festivalId, (logisticsCounts.get(group.festivalId) ?? 0) + group._count._all)
    }
  }
  const allDeadlines = [
    ...data.entries.flatMap((entry) => entry.deadline ? [{
      id: `entry:${entry.id}`,
      festivalId: entry.festivalId,
      title: entry.itemTitle,
      kind: 'Entry submission',
      dueAt: entry.deadline,
    }] : []),
    ...data.invitations.flatMap((invitation) => invitation.responseDeadline ? [{
      id: `invitation:${invitation.id}`,
      festivalId: invitation.festivalId,
      title: 'Respond to festival invitation',
      kind: 'Invitation response',
      dueAt: invitation.responseDeadline,
    }] : []),
    ...data.logisticsItems.flatMap((item) => item.dueAt ? [{
      id: `logistics:${item.id}`,
      festivalId: item.festivalId,
      title: item.title,
      kind: 'Logistics',
      dueAt: item.dueAt,
    }] : []),
  ].flatMap((item) => {
    const festival = festivalById.get(item.festivalId)
    return festival ? [{
      ...item,
      festivalName: festival.name,
      overdue: nairobiDateKey(item.dueAt) < today,
    }] : []
  })
  const overdueDeadlines = allDeadlines
    .filter((item) => item.overdue)
    .sort((left, right) => right.dueAt.getTime() - left.dueAt.getTime())
  const upcomingDeadlines = allDeadlines
    .filter((item) => !item.overdue)
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime())
  const priorityDeadlines = [...overdueDeadlines.slice(0, 6), ...upcomingDeadlines.slice(0, 6)]
  const priorityIds = new Set(priorityDeadlines.map((item) => item.id))
  const deadlines = [
    ...priorityDeadlines,
    ...allDeadlines
      .filter((item) => !priorityIds.has(item.id))
      .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime()),
  ].slice(0, 12)

  const summaries = upcomingFestivals.map((festival) => {
    const festivalApprovals = data.approvals.filter((approval) => approval.festivalId === festival.id)
    const festivalBudget = data.budgetItems.filter((item) => item.festivalId === festival.id)
    const pendingBudgetApprovals = festivalApprovals.filter((approval) =>
      approval.type === 'BUDGET' && approval.status === 'PENDING',
    ).length
    const pendingPlanApproval = festivalApprovals.some((approval) =>
      approval.type === 'PLAN' && approval.status === 'PENDING',
    )
    const entryStatusCounts = entryCounts.get(festival.id) ?? {}
    const budgetSummary = summarizeFestivalBudget(festivalBudget.map((item) => ({
      type: item.type,
      plannedAmount: item.plannedAmount,
      approvedAmount: approvedAmounts.get(item.id) ?? null,
      actualAmount: sumLinkedFinanceAmounts(linkedAmounts.get(item.id) ?? []),
    })))
    return {
      ...festival,
      entryStatusCounts,
      budgetSummary,
      pendingPlanApproval,
      pendingBudgetApprovals,
      incompleteLogistics: logisticsCounts.get(festival.id) ?? 0,
    }
  })
  const pendingApprovals = data.approvals.filter((approval) => approval.status === 'PENDING').length
  const incompleteLogistics = activeFestivals.reduce(
    (total, festival) => total + (logisticsCounts.get(festival.id) ?? 0),
    0,
  )

  return {
    upcomingFestivals,
    upcomingFestivalCount: activeFestivals.length,
    deadlines,
    summaries,
    pendingApprovals,
    incompleteLogistics,
  }
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
    const nextDates = dateFields(input)
    const next = {
      name: input.name,
      year: input.year,
      organizer: input.organizer || null,
      venue: input.venue || null,
      ...nextDates,
      status: input.status,
      notes: input.notes || null,
    }
    const planChanged = previous.name !== next.name
      || previous.year !== next.year
      || previous.organizer !== next.organizer
      || previous.venue !== next.venue
      || previous.startDate?.getTime() !== next.startDate?.getTime()
      || previous.endDate?.getTime() !== next.endDate?.getTime()
      || previous.status !== next.status
      || previous.notes !== next.notes
    if (!planChanged) return { festival: previous, planResubmitted: false }

    const planApprovalKey = targetKey('PLAN', input.festivalId)
    const priorApproval = await festivalsRepository.findApprovalByTargetKey(tx, planApprovalKey)
    const planResubmitted = priorApproval?.status === 'APPROVED'

    const festival = await festivalsRepository.update(tx, input.festivalId, next)
    if (planResubmitted) {
      const submittedAt = new Date()
      const reset = await festivalsRepository.resubmitApprovedApproval(tx, planApprovalKey, {
        status: 'PENDING',
        submittedById: actorId,
        submittedAt,
        approvedAmount: null,
        decidedById: null,
        decidedAt: null,
        decisionReason: null,
      })
      if (!reset.count) throw new FestivalServiceError('The plan approval changed while its details were being edited.')
      await writeAuditLog(tx, {
        actorId,
        action: 'FESTIVAL_PLAN_RESUBMITTED',
        entity: 'Festival',
        entityId: festival.id,
        details: { submittedAt: submittedAt.toISOString(), reason: 'Approved festival details changed.' },
      })
    }
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
    return { festival, planResubmitted }
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
    budgetSummary: summarizeFestivalBudget(planning.budgetItems.map((item) => ({
      ...item,
      approvedAmount: item.approval?.status === 'APPROVED' ? item.approval.approvedAmount : null,
    }))),
  }
}

export async function createFestivalLogisticsItem(input: FestivalLogisticsItemInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    if (!await festivalsRepository.festivalExists(tx, input.festivalId)) {
      throw new FestivalServiceError('Festival not found.')
    }
    if (input.assignedMemberId && !await festivalsRepository.isCurrentActiveMember(tx, input.assignedMemberId)) {
      throw new FestivalServiceError('Choose an active member in the current season as the assignee.')
    }
    const item = await festivalsRepository.createLogisticsItem(tx, {
      festivalId: input.festivalId,
      category: input.category,
      title: input.title,
      description: input.description || null,
      dueAt: dateAtNairobi(input.dueAt),
      assignedMemberId: input.assignedMemberId || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_LOGISTICS_ITEM_CREATED',
      entity: 'FestivalLogisticsItem',
      entityId: item.id,
      details: {
        festivalId: input.festivalId,
        category: item.category,
        assignedMemberId: item.assignedMemberId,
        dueAt: item.dueAt?.toISOString() ?? null,
      },
    })
    return item
  }).catch(mapError)
}

export async function updateFestivalLogisticsItem(input: FestivalLogisticsItemUpdateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const previous = await festivalsRepository.findLogisticsItem(tx, input.festivalId, input.logisticsItemId)
    if (!previous) throw new FestivalServiceError('Logistics item not found for this festival.')
    if (input.assignedMemberId && !await festivalsRepository.isCurrentActiveMember(tx, input.assignedMemberId)) {
      throw new FestivalServiceError('Choose an active member in the current season as the assignee.')
    }
    const next = {
      category: input.category,
      title: input.title,
      description: input.description || null,
      dueAt: dateAtNairobi(input.dueAt),
      assignedMemberId: input.assignedMemberId || null,
    }
    const itemChanged = previous.category !== next.category
      || previous.title !== next.title
      || previous.description !== next.description
      || previous.dueAt?.getTime() !== next.dueAt?.getTime()
      || previous.assignedMemberId !== next.assignedMemberId
    if (!itemChanged) return { updated: false }

    const updated = await festivalsRepository.updateLogisticsItem(
      tx,
      input.festivalId,
      input.logisticsItemId,
      next,
    )
    if (!updated.count) throw new FestivalServiceError('Logistics item not found for this festival.')
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_LOGISTICS_ITEM_UPDATED',
      entity: 'FestivalLogisticsItem',
      entityId: previous.id,
      details: {
        festivalId: input.festivalId,
        from: {
          category: previous.category,
          title: previous.title,
          assignedMemberId: previous.assignedMemberId,
          dueAt: previous.dueAt?.toISOString() ?? null,
        },
        to: {
          category: next.category,
          title: next.title,
          assignedMemberId: next.assignedMemberId,
          dueAt: next.dueAt?.toISOString() ?? null,
        },
      },
    })
    return { updated: true }
  }).catch(mapError)
}

export async function updateFestivalLogisticsStatus(
  input: FestivalLogisticsStatusInput,
  actorId: string,
) {
  return festivalsRepository.transaction(async (tx) => {
    const item = await festivalsRepository.findLogisticsItem(tx, input.festivalId, input.logisticsItemId)
    if (!item) throw new FestivalServiceError('Logistics item not found for this festival.')
    if (item.status === input.status) return { status: item.status, changed: false }

    const completedAt = input.status === 'COMPLETED' ? new Date() : null
    const updated = await festivalsRepository.transitionLogisticsItem(
      tx,
      input.festivalId,
      input.logisticsItemId,
      item.status,
      {
        status: input.status,
        completedAt,
        completedById: completedAt ? actorId : null,
      },
    )
    if (!updated.count) throw new FestivalServiceError('This logistics item has already changed status.')
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_LOGISTICS_STATUS_CHANGED',
      entity: 'FestivalLogisticsItem',
      entityId: item.id,
      details: {
        festivalId: input.festivalId,
        from: item.status,
        to: input.status,
        completedAt: completedAt?.toISOString() ?? null,
      },
    })
    return { status: input.status, changed: true }
  }).catch(mapError)
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

export async function updateFestivalBudgetItem(input: FestivalBudgetItemUpdateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const previous = await festivalsRepository.findBudgetItem(tx, input.festivalId, input.budgetItemId)
    if (!previous) throw new FestivalServiceError('Budget item not found for this festival.')
    const next = {
      type: input.type,
      category: input.category,
      plannedAmount: input.plannedAmount,
      notes: input.notes || null,
    }
    const itemChanged = previous.type !== next.type
      || previous.category !== next.category
      || previous.plannedAmount !== next.plannedAmount
      || previous.notes !== next.notes
    if (!itemChanged) return { updated: false, approvalResubmitted: false }
    if (previous.type !== input.type && await festivalsRepository.countFinanceLinksForBudgetItem(tx, previous.id)) {
      throw new FestivalServiceError('The income/expense type cannot change while finance entries are linked.')
    }
    const updated = await festivalsRepository.updateBudgetItem(tx, input.festivalId, input.budgetItemId, {
      ...next,
    })
    if (!updated.count) throw new FestivalServiceError('Budget item not found for this festival.')

    const approvalKey = targetKey('BUDGET', input.budgetItemId)
    const approval = await festivalsRepository.findApprovalByTargetKey(tx, approvalKey)
    let approvalResubmitted = false
    if (approval?.status === 'APPROVED') {
      const submittedAt = new Date()
      const reset = await festivalsRepository.resubmitApprovedApproval(tx, approvalKey, {
        status: 'PENDING',
        requestedAmount: input.plannedAmount,
        approvedAmount: null,
        submittedById: actorId,
        submittedAt,
        decidedById: null,
        decidedAt: null,
        decisionReason: null,
      })
      if (!reset.count) throw new FestivalServiceError('The budget approval changed while this item was being edited.')
      approvalResubmitted = true
    } else if (approval?.status === 'PENDING') {
      await festivalsRepository.updatePendingApprovalAmount(tx, approvalKey, input.plannedAmount)
    }

    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_BUDGET_ITEM_UPDATED',
      entity: 'FestivalBudgetItem',
      entityId: input.budgetItemId,
      details: {
        festivalId: input.festivalId,
        from: { type: previous.type, category: previous.category, plannedAmount: previous.plannedAmount },
        to: { type: input.type, category: input.category, plannedAmount: input.plannedAmount },
        approvalResubmitted,
      },
    })
    return { updated: true, approvalResubmitted }
  }).catch(mapError)
}

async function submitApprovalRequest(tx: Prisma.TransactionClient, input: {
  festivalId: string
  targetKey: string
  type: 'PLAN' | 'BUDGET'
  budgetItemId?: string
  requestedAmount?: number
  actorId: string
}) {
  const existing = await festivalsRepository.findApprovalByTargetKey(tx, input.targetKey)
  if (existing?.status === 'PENDING') throw new FestivalServiceError('This approval request is already pending.')
  if (existing?.status === 'APPROVED') throw new FestivalServiceError('This request has already been approved.')
  const submittedAt = new Date()
  if (existing) {
    const resubmitted = await festivalsRepository.resubmitRejectedApproval(tx, existing.id, {
      status: 'PENDING',
      requestedAmount: input.requestedAmount ?? null,
      approvedAmount: null,
      submittedById: input.actorId,
      submittedAt,
      decidedById: null,
      decidedAt: null,
      decisionReason: null,
    })
    if (!resubmitted.count) throw new FestivalServiceError('This approval request changed while it was being resubmitted.')
    await writeAuditLog(tx, {
      actorId: input.actorId,
      action: 'FESTIVAL_APPROVAL_RESUBMITTED',
      entity: 'FestivalApproval',
      entityId: existing.id,
      details: {
        festivalId: input.festivalId,
        type: input.type,
        requestedAmount: input.requestedAmount ?? null,
      },
    })
    return { id: existing.id, status: 'PENDING' as const }
  }

  const approval = await festivalsRepository.createApproval(tx, {
    festivalId: input.festivalId,
    budgetItemId: input.budgetItemId ?? null,
    targetKey: input.targetKey,
    type: input.type,
    requestedAmount: input.requestedAmount ?? null,
    submittedById: input.actorId,
    submittedAt,
  })
  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: 'FESTIVAL_APPROVAL_SUBMITTED',
    entity: 'FestivalApproval',
    entityId: approval.id,
    details: {
      festivalId: input.festivalId,
      type: input.type,
      budgetItemId: input.budgetItemId ?? null,
      requestedAmount: input.requestedAmount ?? null,
    },
  })
  return approval
}

export async function submitFestivalPlanApproval(input: FestivalPlanApprovalSubmitInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const festival = await festivalsRepository.findFestivalForApproval(tx, input.festivalId)
    if (!festival) throw new FestivalServiceError('Festival not found.')
    if (festival.status === 'COMPLETED' || festival.status === 'CANCELLED') {
      throw new FestivalServiceError('A completed or cancelled festival plan cannot be submitted for approval.')
    }
    return submitApprovalRequest(tx, {
      festivalId: festival.id,
      targetKey: targetKey('PLAN', festival.id),
      type: 'PLAN',
      actorId,
    })
  }).catch(mapApprovalError)
}

export async function submitFestivalBudgetApproval(input: FestivalBudgetApprovalSubmitInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const item = await festivalsRepository.findBudgetItem(tx, input.festivalId, input.budgetItemId)
    if (!item) throw new FestivalServiceError('Budget item not found for this festival.')
    return submitApprovalRequest(tx, {
      festivalId: input.festivalId,
      targetKey: targetKey('BUDGET', item.id),
      type: 'BUDGET',
      budgetItemId: item.id,
      requestedAmount: item.plannedAmount,
      actorId,
    })
  }).catch(mapApprovalError)
}

export async function decideFestivalApproval(input: FestivalApprovalDecisionInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const approval = await festivalsRepository.findApprovalById(tx, input.approvalId)
    if (!approval) throw new FestivalServiceError('Festival approval request not found.')
    if (approval.status !== 'PENDING') throw new FestivalServiceError('This approval request has already been decided.')
    if (input.decision === 'REJECTED' && input.reason.trim().length < 5) {
      throw new FestivalServiceError('Add a reason when rejecting a request.')
    }
    if (approval.type === 'PLAN' && input.approvedAmount !== null) {
      throw new FestivalServiceError('Plan approvals do not have an approved amount.')
    }
    if (approval.type === 'BUDGET' && input.decision === 'APPROVED') {
      if (approval.requestedAmount === null) throw new FestivalServiceError('Budget request is missing its requested amount.')
      validateBudgetApprovalAmount(approval.requestedAmount, input.approvedAmount, input.reason)
    }

    const decidedAt = new Date()
    const approvedAmount = approval.type === 'BUDGET' && input.decision === 'APPROVED'
      ? input.approvedAmount
      : null
    const updated = await festivalsRepository.decideApproval(tx, approval.id, {
      status: input.decision,
      approvedAmount,
      decidedById: actorId,
      decidedAt,
      decisionReason: input.reason || null,
    })
    if (!updated.count) throw new FestivalServiceError('This approval request has already been decided.')
    await writeAuditLog(tx, {
      actorId,
      action: `FESTIVAL_APPROVAL_${input.decision}`,
      entity: 'FestivalApproval',
      entityId: approval.id,
      details: {
        festivalId: approval.festivalId,
        type: approval.type,
        requestedAmount: approval.requestedAmount,
        approvedAmount,
        reason: input.reason || null,
        decidedAt: decidedAt.toISOString(),
      },
    })
    return { status: input.decision, approvedAmount, decidedAt }
  }).catch(mapApprovalError)
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
