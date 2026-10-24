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
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import {
  createFestivalEntry,
  FestivalServiceError,
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
})
