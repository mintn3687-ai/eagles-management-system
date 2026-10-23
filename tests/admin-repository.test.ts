import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  memberCount: vi.fn(),
  memberFindMany: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  prisma: { member: { count: mocks.memberCount, findMany: mocks.memberFindMany } },
}))

import { adminRepository } from '../src/modules/admin/repository'

describe('rehearsal attendance sheet members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts active members and members with attendance for this rehearsal', async () => {
    mocks.memberCount.mockResolvedValue(2)

    await expect(adminRepository.attendanceSheetMemberCount('rehearsal-1')).resolves.toBe(2)
    expect(mocks.memberCount).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { rehearsals: { some: { rehearsalId: 'rehearsal-1' } } },
        ],
      },
    })
  })

  it('loads recorded attendees even if their current status is no longer active', async () => {
    mocks.memberFindMany.mockResolvedValue([])

    await adminRepository.attendanceSheetMembers('rehearsal-1', 0, 20)
    expect(mocks.memberFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { rehearsals: { some: { rehearsalId: 'rehearsal-1' } } },
        ],
      },
      select: expect.objectContaining({ status: true }),
    }))
  })
})
