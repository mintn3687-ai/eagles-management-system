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
    createFestivalDocumentUpload: vi.fn(),
    completeFestivalDocumentUpload: vi.fn(),
    getFestivalDocumentDownload: vi.fn(),
    deleteFestivalDocument: vi.fn(),
  }
})

vi.mock('@/lib/permissions', () => ({
  AccessError: mocks.AccessError,
  requirePermission: mocks.requirePermission,
}))
vi.mock('../src/modules/festivals/service', () => ({
  FestivalDocumentServiceError: class FestivalDocumentServiceError extends Error {
    constructor(message: string, public status: 400 | 404 | 409) {
      super(message)
    }
  },
  createFestivalDocumentUpload: mocks.createFestivalDocumentUpload,
  completeFestivalDocumentUpload: mocks.completeFestivalDocumentUpload,
  getFestivalDocumentDownload: mocks.getFestivalDocumentDownload,
  deleteFestivalDocument: mocks.deleteFestivalDocument,
}))

import { POST as createUpload } from '../src/app/api/admin/festivals/[festivalId]/documents/route'
import {
  DELETE as deleteDocument,
  GET as getDownload,
  POST as completeUpload,
} from '../src/app/api/admin/festivals/[festivalId]/documents/[documentId]/route'

const context = {
  params: Promise.resolve({ festivalId: 'festival-id', documentId: 'document-id' }),
}

function postRequest(url: string, body?: unknown, origin = 'https://club.example.test') {
  return new Request(url, {
    method: 'POST',
    headers: {
      origin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('festival document API authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({ id: 'committee-user' })
    mocks.createFestivalDocumentUpload.mockResolvedValue({ documentId: 'document-id' })
    mocks.completeFestivalDocumentUpload.mockResolvedValue({ id: 'document-id', status: 'READY' })
    mocks.getFestivalDocumentDownload.mockResolvedValue({ url: 'https://storage.example.test/signed' })
    mocks.deleteFestivalDocument.mockResolvedValue(undefined)
  })

  it('requires festival and finance permissions before upload initialization', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new mocks.AccessError(403))
    const response = await createUpload(postRequest(
      'https://club.example.test/api/admin/festivals/festival-id/documents',
      { festivalId: 'festival-id', fileName: 'letter.pdf', sizeBytes: 1024 },
    ), context)

    expect(response.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('festivals:manage')
    expect(mocks.createFestivalDocumentUpload).not.toHaveBeenCalled()
  })

  it('rejects cross-origin state changes and mismatched festival ids', async () => {
    const crossOrigin = await createUpload(postRequest(
      'https://club.example.test/api/admin/festivals/festival-id/documents',
      { festivalId: 'festival-id', fileName: 'letter.pdf', sizeBytes: 1024 },
      'https://attacker.example',
    ), context)
    expect(crossOrigin.status).toBe(403)
    expect(mocks.createFestivalDocumentUpload).not.toHaveBeenCalled()

    const mismatched = await createUpload(postRequest(
      'https://club.example.test/api/admin/festivals/festival-id/documents',
      { festivalId: 'other-festival', fileName: 'letter.pdf', sizeBytes: 1024 },
    ), context)
    expect(mismatched.status).toBe(400)
    expect(mocks.createFestivalDocumentUpload).not.toHaveBeenCalled()
  })

  it('scopes completion, download, and deletion to authorized festival document ids', async () => {
    await completeUpload(postRequest(
      'https://club.example.test/api/admin/festivals/festival-id/documents/document-id',
    ), context)
    const download = await getDownload(new Request(
      'https://club.example.test/api/admin/festivals/festival-id/documents/document-id',
    ), context)
    await deleteDocument(new Request(
      'https://club.example.test/api/admin/festivals/festival-id/documents/document-id',
      { method: 'DELETE', headers: { origin: 'https://club.example.test' } },
    ), context)

    expect(mocks.requirePermission.mock.calls).toEqual([
      ['festivals:manage'], ['finance:manage'],
      ['festivals:manage'], ['finance:manage'],
      ['festivals:manage'], ['finance:manage'],
    ])
    expect(mocks.completeFestivalDocumentUpload).toHaveBeenCalledWith(
      'festival-id', 'document-id', 'committee-user',
    )
    expect(mocks.getFestivalDocumentDownload).toHaveBeenCalledWith('festival-id', 'document-id')
    expect(mocks.deleteFestivalDocument).toHaveBeenCalledWith(
      'festival-id', 'document-id', 'committee-user',
    )
    expect(download.headers.get('cache-control')).toContain('no-store')
  })
})
