import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findProduction: vi.fn(),
  updateProductionStatus: vi.fn(),
  findTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  findAsset: vi.fn(),
  moveAsset: vi.fn(),
  isCurrentActiveMember: vi.fn(),
  lockRow: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/productions/repository', () => ({
  productionsRepository: {
    transaction: mocks.transaction,
    findProduction: mocks.findProduction,
    updateProductionStatus: mocks.updateProductionStatus,
    findTask: mocks.findTask,
    updateTaskStatus: mocks.updateTaskStatus,
    findAsset: mocks.findAsset,
    moveAsset: mocks.moveAsset,
    isCurrentActiveMember: mocks.isCurrentActiveMember,
  },
}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))

import {
  checkoutAsset,
  checkinAsset,
  ProductionServiceError,
  transitionProduction,
  updateProductionTaskStatus,
} from '../src/modules/productions/service'

const productionId = 'c123456789012345678901234'
const taskId = 'c123456789012345678901235'
const assetId = 'c123456789012345678901236'

describe('production service workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.findProduction.mockResolvedValue({ id: productionId, title: 'Play', status: 'PLANNING' })
    mocks.updateProductionStatus.mockResolvedValue(undefined)
    mocks.findTask.mockResolvedValue({ id: taskId, status: 'OPEN' })
    mocks.updateTaskStatus.mockResolvedValue(undefined)
    mocks.findAsset.mockResolvedValue({ id: assetId, name: 'Lantern', status: 'AVAILABLE', currentHolderMemberId: null })
    mocks.moveAsset.mockResolvedValue(undefined)
    mocks.isCurrentActiveMember.mockResolvedValue({ memberId: 'member-id' })
  })

  it('locks and audits a valid production lifecycle transition', async () => {
    await expect(transitionProduction(productionId, 'ACTIVE', 'actor-id')).resolves.toEqual({ status: 'ACTIVE' })
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'Production', productionId)
    expect(mocks.updateProductionStatus).toHaveBeenCalledWith({}, productionId, 'ACTIVE')
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'PRODUCTION_STATUS_CHANGED',
      details: { from: 'PLANNING', to: 'ACTIVE' },
    }))
  })

  it('rejects invalid task transitions before updating', async () => {
    mocks.findTask.mockResolvedValue({ id: taskId, status: 'COMPLETED' })
    await expect(updateProductionTaskStatus(productionId, taskId, 'OPEN', 'actor-id')).rejects.toBeInstanceOf(ProductionServiceError)
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled()
  })

  it('requires an active member and records asset checkout/check-in movements', async () => {
    await checkoutAsset(assetId, 'member-id', 'actor-id')
    expect(mocks.lockRow).toHaveBeenCalledWith({}, 'Asset', assetId)
    expect(mocks.moveAsset).toHaveBeenCalledWith({}, assetId, {
      status: 'CHECKED_OUT', currentHolderMemberId: 'member-id', updatedById: 'actor-id',
    })

    mocks.findAsset.mockResolvedValue({ id: assetId, name: 'Lantern', status: 'CHECKED_OUT', currentHolderMemberId: 'member-id' })
    await checkinAsset(assetId, 'actor-id')
    expect(mocks.moveAsset).toHaveBeenLastCalledWith({}, assetId, {
      status: 'AVAILABLE', currentHolderMemberId: null, updatedById: 'actor-id',
    })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'PRODUCTION_ASSET_CHECKED_IN',
      details: { previousHolderMemberId: 'member-id' },
    }))
  })

  it('does not check out assets to inactive members or check out an asset twice', async () => {
    mocks.isCurrentActiveMember.mockResolvedValue(null)
    await expect(checkoutAsset(assetId, 'inactive-member', 'actor-id')).rejects.toThrow(/active member/)
    expect(mocks.moveAsset).not.toHaveBeenCalled()

    mocks.findAsset.mockResolvedValue({ id: assetId, name: 'Lantern', status: 'CHECKED_OUT', currentHolderMemberId: 'member-id' })
    await expect(checkoutAsset(assetId, 'member-id', 'actor-id')).rejects.toThrow(/already checked out/)
    expect(mocks.moveAsset).not.toHaveBeenCalled()
  })
})
