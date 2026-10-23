import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  updateMany: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLog,
}))

import { consentRepository } from '../src/modules/consent/repository'

describe('consent repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work({ user: { updateMany: mocks.updateMany } }))
  })

  it('records acceptance and writes an audit event only for the first acceptance', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 })
    const acceptedAt = new Date('2026-10-23T12:00:00.000Z')

    await consentRepository.accept('user-1', acceptedAt)

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', consentAcceptedAt: null },
      data: { consentAcceptedAt: acceptedAt },
    })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), {
      actorId: 'user-1',
      action: 'CONSENT_ACCEPTED',
      entity: 'User',
      entityId: 'user-1',
      details: {},
    })
  })

  it('does not duplicate an audit event when consent was already recorded', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    await consentRepository.accept('user-1', new Date())

    expect(mocks.writeAuditLog).not.toHaveBeenCalled()
  })
})
