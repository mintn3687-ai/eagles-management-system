import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseNairobiDate } from '../src/lib/dates'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findForUpdate: vi.fn(),
  update: vi.fn(),
  findFestivalForApproval: vi.fn(),
  festivalExists: vi.fn(),
  categoryForFestival: vi.fn(),
  isCurrentActiveMember: vi.fn(),
  productionExists: vi.fn(),
  createInvitation: vi.fn(),
  findInvitation: vi.fn(),
  transitionInvitation: vi.fn(),
  createCategory: vi.fn(),
  findCategory: vi.fn(),
  updateCategory: vi.fn(),
  createEntry: vi.fn(),
  findEntry: vi.fn(),
  transitionEntry: vi.fn(),
  createLogisticsItem: vi.fn(),
  findLogisticsItem: vi.fn(),
  updateLogisticsItem: vi.fn(),
  transitionLogisticsItem: vi.fn(),
  createBudgetItem: vi.fn(),
  findBudgetItem: vi.fn(),
  updateBudgetItem: vi.fn(),
  countFinanceLinksForBudgetItem: vi.fn(),
  findApprovalByTargetKey: vi.fn(),
  createApproval: vi.fn(),
  resubmitRejectedApproval: vi.fn(),
  resubmitApprovedApproval: vi.fn(),
  updatePendingApprovalAmount: vi.fn(),
  findApprovalById: vi.fn(),
  decideApproval: vi.fn(),
  findFinanceEntry: vi.fn(),
  findFinanceLinkByEntry: vi.fn(),
  createFinanceLink: vi.fn(),
  findFinanceLink: vi.fn(),
  deleteFinanceLink: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/festivals/repository', () => ({
  festivalsRepository: {
    transaction: mocks.transaction,
    findForUpdate: mocks.findForUpdate,
    update: mocks.update,
    findFestivalForApproval: mocks.findFestivalForApproval,
    festivalExists: mocks.festivalExists,
    categoryForFestival: mocks.categoryForFestival,
    isCurrentActiveMember: mocks.isCurrentActiveMember,
    productionExists: mocks.productionExists,
    createInvitation: mocks.createInvitation,
    findInvitation: mocks.findInvitation,
    transitionInvitation: mocks.transitionInvitation,
    createCategory: mocks.createCategory,
    findCategory: mocks.findCategory,
    updateCategory: mocks.updateCategory,
    createEntry: mocks.createEntry,
    findEntry: mocks.findEntry,
    transitionEntry: mocks.transitionEntry,
    createLogisticsItem: mocks.createLogisticsItem,
    findLogisticsItem: mocks.findLogisticsItem,
    updateLogisticsItem: mocks.updateLogisticsItem,
    transitionLogisticsItem: mocks.transitionLogisticsItem,
    createBudgetItem: mocks.createBudgetItem,
    findBudgetItem: mocks.findBudgetItem,
    updateBudgetItem: mocks.updateBudgetItem,
    countFinanceLinksForBudgetItem: mocks.countFinanceLinksForBudgetItem,
    findApprovalByTargetKey: mocks.findApprovalByTargetKey,
    createApproval: mocks.createApproval,
    resubmitRejectedApproval: mocks.resubmitRejectedApproval,
    resubmitApprovedApproval: mocks.resubmitApprovedApproval,
    updatePendingApprovalAmount: mocks.updatePendingApprovalAmount,
    findApprovalById: mocks.findApprovalById,
    decideApproval: mocks.decideApproval,
    findFinanceEntry: mocks.findFinanceEntry,
    findFinanceLinkByEntry: mocks.findFinanceLinkByEntry,
    createFinanceLink: mocks.createFinanceLink,
    findFinanceLink: mocks.findFinanceLink,
    deleteFinanceLink: mocks.deleteFinanceLink,
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import {
  createFestivalEntry,
  createFestivalBudgetItem,
  createFestivalLogisticsItem,
  updateFestivalLogisticsItem,
  updateFestivalLogisticsStatus,
  updateFestival,
  updateFestivalBudgetItem,
  submitFestivalPlanApproval,
  submitFestivalBudgetApproval,
  decideFestivalApproval,
  FestivalServiceError,
  linkFestivalFinanceEntry,
  unlinkFestivalFinanceEntry,
  updateFestivalEntryStatus,
  updateFestivalInvitationStatus,
} from '../src/modules/festivals/service'

describe('festival entries and invitations service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.festivalExists.mockResolvedValue({ id: 'festival-id' })
    mocks.isCurrentActiveMember.mockResolvedValue({ memberId: 'member-id' })
    mocks.categoryForFestival.mockResolvedValue({
      id: 'category-id',
      defaultDeadline: parseNairobiDate('2027-03-01'),
    })
    mocks.productionExists.mockResolvedValue({ id: 'production-id' })
    mocks.createEntry.mockResolvedValue({ id: 'entry-id' })
    mocks.findEntry.mockResolvedValue({ id: 'entry-id', status: 'PENDING' })
    mocks.transitionEntry.mockResolvedValue({ count: 1 })
    mocks.createLogisticsItem.mockResolvedValue({
      id: 'logistics-item-id',
      category: 'TRANSPORT',
      assignedMemberId: 'member-id',
      dueAt: parseNairobiDate('2027-03-10'),
    })
    mocks.findLogisticsItem.mockResolvedValue({
      id: 'logistics-item-id',
      category: 'TRANSPORT',
      title: 'Confirm bus',
      description: null,
      dueAt: null,
      assignedMemberId: null,
      status: 'OPEN',
    })
    mocks.updateLogisticsItem.mockResolvedValue({ count: 1 })
    mocks.transitionLogisticsItem.mockResolvedValue({ count: 1 })
    mocks.findInvitation.mockResolvedValue({ id: 'invitation-id', status: 'RECEIVED' })
    mocks.transitionInvitation.mockResolvedValue({ count: 1 })
    mocks.createBudgetItem.mockResolvedValue({ id: 'budget-item-id', category: 'Transport', plannedAmount: 50000 })
    mocks.findBudgetItem.mockResolvedValue({
      id: 'budget-item-id', type: 'EXPENSE', category: 'Transport', plannedAmount: 50000, notes: null,
    })
    mocks.findForUpdate.mockResolvedValue({
      id: 'festival-id', name: 'Old Festival', year: 2027, organizer: null, venue: null,
      startDate: null, endDate: null, notes: null, status: 'PLANNING',
    })
    mocks.update.mockImplementation(async (_tx, _festivalId, data) => ({ id: 'festival-id', ...data }))
    mocks.findFestivalForApproval.mockResolvedValue({ id: 'festival-id', status: 'PLANNING' })
    mocks.findApprovalByTargetKey.mockResolvedValue(null)
    mocks.createApproval.mockResolvedValue({ id: 'approval-id', status: 'PENDING' })
    mocks.resubmitRejectedApproval.mockResolvedValue({ count: 1 })
    mocks.resubmitApprovedApproval.mockResolvedValue({ count: 1 })
    mocks.updatePendingApprovalAmount.mockResolvedValue({ count: 1 })
    mocks.updateBudgetItem.mockResolvedValue({ count: 1 })
    mocks.countFinanceLinksForBudgetItem.mockResolvedValue(0)
    mocks.findApprovalById.mockResolvedValue({
      id: 'approval-id', festivalId: 'festival-id', type: 'BUDGET', status: 'PENDING',
      requestedAmount: 50000,
    })
    mocks.decideApproval.mockResolvedValue({ count: 1 })
    mocks.findFinanceEntry.mockResolvedValue({
      id: 'finance-entry-id', type: 'EXPENSE', amount: 45000,
      category: 'Transport', description: 'Bus to festival', occurredAt: parseNairobiDate('2027-04-01'),
    })
    mocks.findFinanceLinkByEntry.mockResolvedValue(null)
    mocks.createFinanceLink.mockResolvedValue({ id: 'finance-link-id' })
    mocks.findFinanceLink.mockResolvedValue({
      id: 'finance-link-id', budgetItemId: 'budget-item-id', financeEntryId: 'finance-entry-id',
    })
    mocks.deleteFinanceLink.mockResolvedValue({ count: 1 })
    mocks.writeAuditLog.mockResolvedValue(undefined)
  })

  it('checks festival, category, and production scope and applies the configured category deadline', async () => {
    const created = await createFestivalEntry({
      festivalId: 'festival-id',
      categoryId: 'category-id',
      productionId: 'production-id',
      itemTitle: 'The River',
      deadline: null,
      notes: '',
    }, 'committee-user')

    expect(created).toEqual({ id: 'entry-id' })
    expect(mocks.createEntry).toHaveBeenCalledWith({}, {
      festivalId: 'festival-id',
      categoryId: 'category-id',
      productionId: 'production-id',
      itemTitle: 'The River',
      status: 'PENDING',
      deadline: parseNairobiDate('2027-03-01'),
      notes: null,
      createdById: 'committee-user',
    })
  })

  it('rejects a category from another festival before creating an entry', async () => {
    mocks.categoryForFestival.mockResolvedValue(null)
    await expect(createFestivalEntry({
      festivalId: 'festival-id',
      categoryId: 'foreign-category',
      productionId: '',
      itemTitle: 'The River',
      deadline: null,
      notes: '',
    }, 'committee-user')).rejects.toThrow(/category configured for this festival/)
    expect(mocks.createEntry).not.toHaveBeenCalled()
  })

  it('rejects invalid status transitions and a concurrent state change', async () => {
    mocks.findEntry.mockResolvedValue({ id: 'entry-id', status: 'CONFIRMED' })
    await expect(updateFestivalEntryStatus('festival-id', 'entry-id', 'PREPARING', 'committee-user'))
      .rejects.toThrow(FestivalServiceError)
    expect(mocks.transitionEntry).not.toHaveBeenCalled()

    mocks.findEntry.mockResolvedValue({ id: 'entry-id', status: 'PENDING' })
    mocks.transitionEntry.mockResolvedValue({ count: 0 })
    await expect(updateFestivalEntryStatus('festival-id', 'entry-id', 'SUBMITTED', 'committee-user'))
      .rejects.toThrow(/already changed status/)
  })

  it('records invitation responses once and rejects repeated responses', async () => {
    await expect(updateFestivalInvitationStatus('festival-id', 'invitation-id', 'ACCEPTED', 'committee-user'))
      .resolves.toMatchObject({ status: 'ACCEPTED' })
    expect(mocks.transitionInvitation).toHaveBeenCalledWith({}, 'festival-id', 'invitation-id', {
      status: 'ACCEPTED',
      respondedAt: expect.any(Date),
    })

    mocks.findInvitation.mockResolvedValue({ id: 'invitation-id', status: 'DECLINED' })
    await expect(updateFestivalInvitationStatus('festival-id', 'invitation-id', 'ACCEPTED', 'committee-user'))
      .rejects.toThrow(/already been answered/)
  })

  it('creates a planned budget item without writing to the existing finance ledger', async () => {
    await expect(createFestivalBudgetItem({
      festivalId: 'festival-id',
      type: 'EXPENSE',
      category: 'Transport',
      plannedAmount: 50000,
      notes: '',
    }, 'committee-user')).resolves.toMatchObject({ id: 'budget-item-id' })

    expect(mocks.createBudgetItem).toHaveBeenCalledWith({}, expect.objectContaining({
      festivalId: 'festival-id',
      type: 'EXPENSE',
      plannedAmount: 50000,
      createdById: 'committee-user',
    }))
    expect(mocks.createEntry).not.toHaveBeenCalled()
  })

  it('creates an assigned festival logistics item and audits only coordination metadata', async () => {
    await expect(createFestivalLogisticsItem({
      festivalId: 'festival-id',
      category: 'TRANSPORT',
      title: 'Confirm bus departure',
      description: 'Meet at the main gate.',
      dueAt: '2027-03-10',
      assignedMemberId: 'member-id',
    }, 'committee-user')).resolves.toMatchObject({ id: 'logistics-item-id' })

    expect(mocks.isCurrentActiveMember).toHaveBeenCalledWith({}, 'member-id')
    expect(mocks.createLogisticsItem).toHaveBeenCalledWith({}, {
      festivalId: 'festival-id',
      category: 'TRANSPORT',
      title: 'Confirm bus departure',
      description: 'Meet at the main gate.',
      dueAt: parseNairobiDate('2027-03-10'),
      assignedMemberId: 'member-id',
      createdById: 'committee-user',
    })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_LOGISTICS_ITEM_CREATED',
      details: expect.objectContaining({ assignedMemberId: 'member-id' }),
    }))
  })

  it('rejects missing festivals and inactive member assignments', async () => {
    mocks.festivalExists.mockResolvedValue(null)
    await expect(createFestivalLogisticsItem({
      festivalId: 'missing-festival',
      category: 'TRANSPORT',
      title: 'Confirm bus',
      description: '',
      dueAt: null,
      assignedMemberId: '',
    }, 'committee-user')).rejects.toThrow(/Festival not found/)

    mocks.festivalExists.mockResolvedValue({ id: 'festival-id' })
    mocks.isCurrentActiveMember.mockResolvedValue(null)
    await expect(createFestivalLogisticsItem({
      festivalId: 'festival-id',
      category: 'PARTICIPANTS',
      title: 'Coordinate attendance',
      description: '',
      dueAt: null,
      assignedMemberId: 'inactive-member',
    }, 'committee-user')).rejects.toThrow(/active member/)
    expect(mocks.createLogisticsItem).not.toHaveBeenCalled()
  })

  it('updates logistics assignments and item details within the festival scope', async () => {
    await expect(updateFestivalLogisticsItem({
      festivalId: 'festival-id',
      logisticsItemId: 'logistics-item-id',
      category: 'ACCOMMODATION',
      title: 'Confirm rooms',
      description: 'Reserve the agreed rooms.',
      dueAt: '2027-03-11',
      assignedMemberId: 'member-id',
    }, 'committee-user')).resolves.toEqual({ updated: true })
    expect(mocks.updateLogisticsItem).toHaveBeenCalledWith({}, 'festival-id', 'logistics-item-id', {
      category: 'ACCOMMODATION',
      title: 'Confirm rooms',
      description: 'Reserve the agreed rooms.',
      dueAt: parseNairobiDate('2027-03-11'),
      assignedMemberId: 'member-id',
    })

    mocks.findLogisticsItem.mockResolvedValue(null)
    await expect(updateFestivalLogisticsItem({
      festivalId: 'festival-id',
      logisticsItemId: 'foreign-item',
      category: 'ACCOMMODATION',
      title: 'Confirm rooms',
      description: '',
      dueAt: null,
      assignedMemberId: '',
    }, 'committee-user')).rejects.toThrow(/not found for this festival/)
  })

  it('records completion attribution and clears it when a logistics task is reopened', async () => {
    await expect(updateFestivalLogisticsStatus({
      festivalId: 'festival-id',
      logisticsItemId: 'logistics-item-id',
      status: 'COMPLETED',
    }, 'committee-user')).resolves.toMatchObject({ status: 'COMPLETED', changed: true })
    expect(mocks.transitionLogisticsItem).toHaveBeenCalledWith(
      {},
      'festival-id',
      'logistics-item-id',
      'OPEN',
      {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        completedById: 'committee-user',
      },
    )

    mocks.findLogisticsItem.mockResolvedValue({
      id: 'logistics-item-id',
      category: 'TRANSPORT',
      title: 'Confirm bus',
      description: null,
      dueAt: null,
      assignedMemberId: null,
      status: 'COMPLETED',
    })
    await updateFestivalLogisticsStatus({
      festivalId: 'festival-id',
      logisticsItemId: 'logistics-item-id',
      status: 'IN_PROGRESS',
    }, 'committee-user')
    expect(mocks.transitionLogisticsItem).toHaveBeenLastCalledWith(
      {},
      'festival-id',
      'logistics-item-id',
      'COMPLETED',
      { status: 'IN_PROGRESS', completedAt: null, completedById: null },
    )

    mocks.transitionLogisticsItem.mockResolvedValue({ count: 0 })
    await expect(updateFestivalLogisticsStatus({
      festivalId: 'festival-id',
      logisticsItemId: 'logistics-item-id',
      status: 'OPEN',
    }, 'committee-user')).rejects.toThrow(/already changed status/)
  })

  it('links only matching-type, previously unlinked finance entries at their full ledger amount', async () => {
    await expect(linkFestivalFinanceEntry({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
      financeEntryId: 'finance-entry-id',
    }, 'committee-user')).resolves.toEqual({ id: 'finance-link-id' })
    expect(mocks.createFinanceLink).toHaveBeenCalledWith({}, {
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
      financeEntryId: 'finance-entry-id',
      linkedById: 'committee-user',
    })
    expect(mocks.createEntry).not.toHaveBeenCalled()
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_FINANCE_ENTRY_LINKED',
      details: expect.objectContaining({ amount: 45000 }),
    }))
  })

  it('rejects mismatched and already-linked finance entries', async () => {
    mocks.findFinanceEntry.mockResolvedValue({
      id: 'income-entry', type: 'INCOME', amount: 45000,
      category: 'Donation', description: 'Festival donation', occurredAt: new Date(),
    })
    await expect(linkFestivalFinanceEntry({
      festivalId: 'festival-id', budgetItemId: 'budget-item-id', financeEntryId: 'income-entry',
    }, 'committee-user')).rejects.toThrow(/expense finance entry/)
    expect(mocks.createFinanceLink).not.toHaveBeenCalled()

    mocks.findFinanceEntry.mockResolvedValue({
      id: 'finance-entry-id', type: 'EXPENSE', amount: 45000,
      category: 'Transport', description: 'Bus to festival', occurredAt: new Date(),
    })
    mocks.findFinanceLinkByEntry.mockResolvedValue({ id: 'existing-link' })
    await expect(linkFestivalFinanceEntry({
      festivalId: 'festival-id', budgetItemId: 'budget-item-id', financeEntryId: 'finance-entry-id',
    }, 'committee-user')).rejects.toThrow(/already linked/)
  })

  it('removes only the association and audits the unchanged ledger amount', async () => {
    await expect(unlinkFestivalFinanceEntry({
      festivalId: 'festival-id',
      linkId: 'finance-link-id',
    }, 'committee-user')).resolves.toEqual({ unlinked: true })
    expect(mocks.deleteFinanceLink).toHaveBeenCalledWith({}, 'festival-id', 'finance-link-id')
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_FINANCE_ENTRY_UNLINKED',
      details: expect.objectContaining({ financeEntryId: 'finance-entry-id', amount: 45000 }),
    }))
  })

  it('submits plan approval once and allows resubmission after rejection', async () => {
    await expect(submitFestivalPlanApproval({ festivalId: 'festival-id' }, 'committee-user'))
      .resolves.toMatchObject({ status: 'PENDING' })
    expect(mocks.createApproval).toHaveBeenCalledWith({}, expect.objectContaining({
      festivalId: 'festival-id',
      targetKey: 'PLAN:festival-id',
      type: 'PLAN',
      submittedById: 'committee-user',
    }))

    mocks.findApprovalByTargetKey.mockResolvedValue({ id: 'approval-id', status: 'PENDING' })
    await expect(submitFestivalPlanApproval({ festivalId: 'festival-id' }, 'committee-user'))
      .rejects.toThrow(/already pending/)

    mocks.findApprovalByTargetKey.mockResolvedValue({ id: 'approval-id', status: 'REJECTED' })
    await expect(submitFestivalPlanApproval({ festivalId: 'festival-id' }, 'committee-user'))
      .resolves.toMatchObject({ id: 'approval-id', status: 'PENDING' })
    expect(mocks.resubmitRejectedApproval).toHaveBeenCalledWith({}, 'approval-id', expect.objectContaining({
      status: 'PENDING',
      submittedById: 'committee-user',
    }))
  })

  it('submits a budget approval using the current planned amount', async () => {
    await expect(submitFestivalBudgetApproval({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
    }, 'committee-user')).resolves.toMatchObject({ status: 'PENDING' })
    expect(mocks.createApproval).toHaveBeenCalledWith({}, expect.objectContaining({
      targetKey: 'BUDGET:budget-item-id',
      type: 'BUDGET',
      requestedAmount: 50000,
    }))
  })

  it('requires a reason for reduced budget approval and saves full decision metadata', async () => {
    await expect(decideFestivalApproval({
      approvalId: 'approval-id', decision: 'APPROVED', approvedAmount: 40000, reason: '',
    }, 'committee-user')).rejects.toThrow(/Explain why/)
    expect(mocks.decideApproval).not.toHaveBeenCalled()

    await expect(decideFestivalApproval({
      approvalId: 'approval-id', decision: 'APPROVED', approvedAmount: 40000, reason: 'Reduced costs',
    }, 'committee-user')).resolves.toMatchObject({ status: 'APPROVED', approvedAmount: 40000 })
    expect(mocks.decideApproval).toHaveBeenCalledWith({}, 'approval-id', expect.objectContaining({
      status: 'APPROVED',
      approvedAmount: 40000,
      decidedById: 'committee-user',
      decisionReason: 'Reduced costs',
      decidedAt: expect.any(Date),
    }))
  })

  it('requires a rejection reason and guards concurrent approval decisions', async () => {
    await expect(decideFestivalApproval({
      approvalId: 'approval-id', decision: 'REJECTED', approvedAmount: null, reason: '',
    }, 'committee-user')).rejects.toThrow(/reason when rejecting/)

    mocks.decideApproval.mockResolvedValue({ count: 0 })
    await expect(decideFestivalApproval({
      approvalId: 'approval-id', decision: 'REJECTED', approvedAmount: null, reason: 'Not ready',
    }, 'committee-user')).rejects.toThrow(/already been decided/)
  })

  it('returns an approved festival plan to Pending only when details change', async () => {
    mocks.findApprovalByTargetKey.mockResolvedValue({ id: 'approval-id', status: 'APPROVED' })
    const result = await updateFestival({
      festivalId: 'festival-id',
      name: 'New Festival',
      year: 2027,
      organizer: '',
      venue: '',
      startDate: null,
      endDate: null,
      status: 'PLANNING',
      notes: '',
    }, 'committee-user')
    expect(result.planResubmitted).toBe(true)
    expect(mocks.resubmitApprovedApproval).toHaveBeenCalledWith({}, 'PLAN:festival-id', expect.objectContaining({
      status: 'PENDING',
      submittedById: 'committee-user',
    }))

    mocks.findForUpdate.mockResolvedValue({
      id: 'festival-id', name: 'New Festival', year: 2027, organizer: null, venue: null,
      startDate: null, endDate: null, notes: null, status: 'PLANNING',
    })
    mocks.update.mockClear()
    await expect(updateFestival({
      festivalId: 'festival-id',
      name: 'New Festival',
      year: 2027,
      organizer: '',
      venue: '',
      startDate: null,
      endDate: null,
      status: 'PLANNING',
      notes: '',
    }, 'committee-user')).resolves.toMatchObject({ planResubmitted: false })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('resubmits changed approved budget items but leaves unchanged items alone', async () => {
    mocks.findApprovalByTargetKey.mockResolvedValue({ id: 'approval-id', status: 'APPROVED' })
    await expect(updateFestivalBudgetItem({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
      type: 'EXPENSE',
      category: 'Transport',
      plannedAmount: 60000,
      notes: '',
    }, 'committee-user')).resolves.toEqual({ updated: true, approvalResubmitted: true })
    expect(mocks.resubmitApprovedApproval).toHaveBeenCalledWith({}, 'BUDGET:budget-item-id', expect.objectContaining({
      status: 'PENDING',
      requestedAmount: 60000,
      submittedById: 'committee-user',
    }))

    mocks.findBudgetItem.mockResolvedValue({
      id: 'budget-item-id', type: 'EXPENSE', category: 'Transport', plannedAmount: 50000, notes: null,
    })
    mocks.updateBudgetItem.mockClear()
    await expect(updateFestivalBudgetItem({
      festivalId: 'festival-id',
      budgetItemId: 'budget-item-id',
      type: 'EXPENSE',
      category: 'Transport',
      plannedAmount: 50000,
      notes: '',
    }, 'committee-user')).resolves.toEqual({ updated: false, approvalResubmitted: false })
    expect(mocks.updateBudgetItem).not.toHaveBeenCalled()
  })
})
