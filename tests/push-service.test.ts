import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listEligibleSubscriptions: vi.fn(),
  listScheduledRehearsals: vi.fn(),
  claimDelivery: vi.fn(),
  markDeliverySent: vi.fn(),
  removeDelivery: vi.fn(),
  removeSubscriptionById: vi.fn(),
  sendEachForMulticast: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/push/repository', () => ({
  pushRepository: {
    listEligibleSubscriptions: mocks.listEligibleSubscriptions,
    listScheduledRehearsals: mocks.listScheduledRehearsals,
    claimDelivery: mocks.claimDelivery,
    markDeliverySent: mocks.markDeliverySent,
    removeDelivery: mocks.removeDelivery,
    removeSubscriptionById: mocks.removeSubscriptionById,
  },
}))
vi.mock('../src/lib/push/firebase-admin', () => ({
  getFirebaseAdminMessaging: () => ({ sendEachForMulticast: mocks.sendEachForMulticast }),
}))

import { sendUpcomingRehearsalReminders } from '../src/modules/push/service'

describe('push reminder delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listEligibleSubscriptions.mockResolvedValue([{ id: 'sub-1', userId: 'user-1', token: 'token-1' }])
    mocks.listScheduledRehearsals.mockResolvedValue([
      { id: 'past', date: new Date('2026-10-22T21:00:00.000Z'), startTime: '08:30' },
      { id: 'starting-now', date: new Date('2026-10-22T21:00:00.000Z'), startTime: '09:00' },
      { id: 'within-window', date: new Date('2026-10-23T21:00:00.000Z'), startTime: '08:30' },
      { id: 'outside-window', date: new Date('2026-10-23T21:00:00.000Z'), startTime: '10:00' },
    ])
    mocks.claimDelivery.mockResolvedValue(true)
    mocks.sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }] })
    mocks.markDeliverySent.mockResolvedValue(undefined)
  })

  it('sends only the scheduled rehearsal starting within the next 24 hours', async () => {
    const result = await sendUpcomingRehearsalReminders(new Date('2026-10-23T06:00:00.000Z'))

    expect(result).toEqual({ attempted: 1, sent: 1, failed: 0 })
    expect(mocks.claimDelivery).toHaveBeenCalledTimes(1)
    expect(mocks.claimDelivery).toHaveBeenCalledWith('sub-1', 'user-1', 'rehearsal:within-window:daily-24h')
    expect(mocks.sendEachForMulticast).toHaveBeenCalledTimes(1)
  })
})
