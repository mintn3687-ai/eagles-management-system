import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseNairobiDate } from '../src/lib/dates'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  festivalExists: vi.fn(),
  categoryForFestival: vi.fn(),
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
  createBudgetItem: vi.fn(),
  findBudgetItem: vi.fn(),
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
    festivalExists: mocks.festivalExists,
    categoryForFestival: mocks.categoryForFestival,
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
    createBudgetItem: mocks.createBudgetItem,
    findBudgetItem: mocks.findBudgetItem,
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
    mocks.categoryForFestival.mockResolvedValue({
      id: 'category-id',
      defaultDeadline: parseNairobiDate('2027-03-01'),
    })
    mocks.productionExists.mockResolvedValue({ id: 'production-id' })
    mocks.createEntry.mockResolvedValue({ id: 'entry-id' })
    mocks.findEntry.mockResolvedValue({ id: 'entry-id', status: 'PENDING' })
    mocks.transitionEntry.mockResolvedValue({ count: 1 })
    mocks.findInvitation.mockResolvedValue({ id: 'invitation-id', status: 'RECEIVED' })
    mocks.transitionInvitation.mockResolvedValue({ count: 1 })
    mocks.createBudgetItem.mockResolvedValue({ id: 'budget-item-id', category: 'Transport', plannedAmount: 50000 })
    mocks.findBudgetItem.mockResolvedValue({
      id: 'budget-item-id', type: 'EXPENSE', category: 'Transport', plannedAmount: 50000,
    })
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
})
