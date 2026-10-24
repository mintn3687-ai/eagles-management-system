import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createFestivalLogisticsItem: vi.fn(),
  updateFestivalLogisticsStatus: vi.fn(),
  createFestivalBudgetItem: vi.fn(),
  linkFestivalFinanceEntry: vi.fn(),
  decideFestivalApproval: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/permissions', () => ({
  AccessError: class AccessError extends Error {},
  requirePermission: mocks.requirePermission,
}))
vi.mock('../src/modules/festivals/service', () => ({
  createFestivalCategory: vi.fn(),
  createFestivalEntry: vi.fn(),
  createFestivalLogisticsItem: mocks.createFestivalLogisticsItem,
  createFestivalInvitation: vi.fn(),
  createFestivalBudgetItem: mocks.createFestivalBudgetItem,
  createFestival: vi.fn(),
  decideFestivalApproval: mocks.decideFestivalApproval,
  FestivalServiceError: class FestivalServiceError extends Error {},
  linkFestivalFinanceEntry: mocks.linkFestivalFinanceEntry,
  unlinkFestivalFinanceEntry: vi.fn(),
  submitFestivalBudgetApproval: vi.fn(),
  submitFestivalPlanApproval: vi.fn(),
  updateFestivalEntryStatus: vi.fn(),
  updateFestivalLogisticsItem: vi.fn(),
  updateFestivalLogisticsStatus: mocks.updateFestivalLogisticsStatus,
  updateFestivalCategory: vi.fn(),
  updateFestivalInvitationStatus: vi.fn(),
  updateFestival: vi.fn(),
  updateFestivalBudgetItem: vi.fn(),
}))

import { AccessError } from '@/lib/permissions'
import {
  createFestivalBudgetItemAction,
  createFestivalLogisticsItemAction,
  decideFestivalApprovalAction,
  linkFestivalFinanceEntryAction,
  updateFestivalLogisticsStatusAction,
} from '../src/modules/festivals/actions'

describe('festival server-action authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({ id: 'committee-user' })
  })

  it.each([
    ['create logistics', createFestivalLogisticsItemAction, 'festivals:manage', ['festivals:manage'], mocks.createFestivalLogisticsItem],
    ['update logistics status', updateFestivalLogisticsStatusAction, 'festivals:manage', ['festivals:manage'], mocks.updateFestivalLogisticsStatus],
    ['create budget item', createFestivalBudgetItemAction, 'finance:manage', ['festivals:manage', 'finance:manage'], mocks.createFestivalBudgetItem],
    ['link ledger entry', linkFestivalFinanceEntryAction, 'finance:manage', ['festivals:manage', 'finance:manage'], mocks.linkFestivalFinanceEntry],
    ['decide approval without approval permission', decideFestivalApprovalAction, 'festivals:approve', ['festivals:approve'], mocks.decideFestivalApproval],
    ['decide approval without finance permission', decideFestivalApprovalAction, 'finance:manage', ['festivals:approve', 'finance:manage'], mocks.decideFestivalApproval],
  ])('%s is denied before its service can write', async (_name, action, deniedPermission, permissions, service) => {
    mocks.requirePermission.mockImplementation(async (permission: string) => {
      if (permission === deniedPermission) throw new AccessError(403, 'ROLE')
      return { id: 'committee-user' }
    })
    const result = await action({}, new FormData())

    expect(result.error).toBeTruthy()
    expect(mocks.requirePermission.mock.calls.map(([permission]) => permission)).toEqual(permissions)
    expect(service).not.toHaveBeenCalled()
  })
})
