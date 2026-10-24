import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class MockAccessError extends Error {
    constructor(public status: 401 | 403 = 403) {
      super('Access denied.')
    }
  }
  return {
    AccessError: MockAccessError,
    requirePermission: vi.fn(),
    getFestival: vi.fn(),
    getFestivalPlanning: vi.fn(),
    createFestivalProposalPdf: vi.fn(),
  }
})

vi.mock('@/lib/permissions', () => ({
  AccessError: mocks.AccessError,
  requirePermission: mocks.requirePermission,
}))
vi.mock('../src/modules/festivals/service', () => ({
  getFestival: mocks.getFestival,
  getFestivalPlanning: mocks.getFestivalPlanning,
}))
vi.mock('../src/modules/festivals/proposal-pdf', () => ({
  createFestivalProposalPdf: mocks.createFestivalProposalPdf,
}))

import { GET } from '../src/app/api/admin/festivals/[festivalId]/proposal/route'

const context = { params: Promise.resolve({ festivalId: 'festival-id' }) }

describe('festival proposal PDF route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({ id: 'committee-user' })
    mocks.getFestival.mockResolvedValue({
      id: 'festival-id',
      name: 'National Drama Festival',
      year: 2027,
    })
    mocks.getFestivalPlanning.mockResolvedValue({ budgetItems: [] })
    mocks.createFestivalProposalPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]))
  })

  it('requires festival and finance permissions and serves a private downloadable PDF', async () => {
    const response = await GET(new Request('https://club.example.test/api/admin/festivals/festival-id/proposal'), context)

    expect(mocks.requirePermission.mock.calls).toEqual([
      ['festivals:manage'],
      ['finance:manage'],
    ])
    expect(mocks.getFestivalPlanning).toHaveBeenCalledWith('festival-id', true)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-disposition')).toContain('National-Drama-Festival-2027-festival-proposal.pdf')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70, 45]))
  })

  it('returns not found when the festival record does not exist', async () => {
    mocks.getFestival.mockResolvedValue(null)

    const response = await GET(new Request('https://club.example.test/api/admin/festivals/missing/proposal'), context)

    expect(response.status).toBe(404)
    expect(mocks.createFestivalProposalPdf).not.toHaveBeenCalled()
  })

  it('does not read protected festival data without permissions', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new mocks.AccessError(403))

    const response = await GET(new Request('https://club.example.test/api/admin/festivals/festival-id/proposal'), context)

    expect(response.status).toBe(403)
    expect(mocks.getFestival).not.toHaveBeenCalled()
  })
})
