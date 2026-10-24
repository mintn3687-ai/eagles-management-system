import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  festivalExists: vi.fn(),
  createFestivalDocument: vi.fn(),
  findFestivalDocument: vi.fn(),
  markFestivalDocumentReady: vi.fn(),
  deleteFestivalDocument: vi.fn(),
  writeAuditLog: vi.fn(),
  createUploadUrl: vi.fn(),
  headObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  deleteObject: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('../src/modules/festivals/repository', () => ({
  festivalsRepository: {
    transaction: mocks.transaction,
    festivalExists: mocks.festivalExists,
    createFestivalDocument: mocks.createFestivalDocument,
    findFestivalDocument: mocks.findFestivalDocument,
    markFestivalDocumentReady: mocks.markFestivalDocumentReady,
    deleteFestivalDocument: mocks.deleteFestivalDocument,
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('../src/modules/festivals/storage', () => ({
  festivalDocumentStorage: {
    createUploadUrl: mocks.createUploadUrl,
    headObject: mocks.headObject,
    createDownloadUrl: mocks.createDownloadUrl,
    deleteObject: mocks.deleteObject,
  },
}))

import {
  completeFestivalDocumentUpload,
  createFestivalDocumentUpload,
  deleteFestivalDocument,
  FestivalDocumentServiceError,
  getFestivalDocumentDownload,
} from '../src/modules/festivals/service'
import {
  festivalDocumentIdSchema,
  festivalDocumentUploadSchema,
} from '../src/modules/festivals/schema'
import { MAX_FESTIVAL_DOCUMENT_BYTES } from '../src/modules/festivals/document-constants'

const uploadExpiresAt = new Date('2027-04-01T10:10:00.000Z')
const pendingDocument = {
  id: 'document-id',
  festivalId: 'festival-id',
  originalName: 'Festival letter.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1234,
  storageKey: 'festivals/festival-id/object-key',
  uploadedById: 'committee-user',
  status: 'PENDING_UPLOAD',
  uploadExpiresAt,
  uploadedAt: null,
  createdAt: new Date('2027-04-01T10:00:00.000Z'),
  updatedAt: new Date('2027-04-01T10:00:00.000Z'),
}

describe('festival document validation and workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-04-01T10:00:00.000Z'))
    mocks.transaction.mockImplementation(async (work) => work({}))
    mocks.festivalExists.mockResolvedValue({ id: 'festival-id' })
    mocks.createFestivalDocument.mockResolvedValue(pendingDocument)
    mocks.findFestivalDocument.mockResolvedValue(pendingDocument)
    mocks.markFestivalDocumentReady.mockResolvedValue({ count: 1 })
    mocks.deleteFestivalDocument.mockResolvedValue({ count: 1 })
    mocks.createUploadUrl.mockResolvedValue('https://storage.example.test/upload')
    mocks.headObject.mockResolvedValue({ sizeBytes: 1234, contentType: 'application/pdf' })
    mocks.createDownloadUrl.mockResolvedValue('https://storage.example.test/signed-download')
    mocks.deleteObject.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts supported file types and rejects unsafe names, mismatched types, and oversized files', () => {
    const input = { festivalId: 'festival-id', fileName: 'Festival letter.pdf', sizeBytes: 1234 }
    expect(festivalDocumentUploadSchema.parse(input)).toEqual({
      ...input,
      contentType: 'application/pdf',
    })
    expect(festivalDocumentUploadSchema.safeParse({ ...input, fileName: '../letter.pdf' }).success).toBe(false)
    expect(festivalDocumentUploadSchema.safeParse({ ...input, fileName: 'letter.exe' }).success).toBe(false)
    expect(festivalDocumentUploadSchema.safeParse({
      ...input,
      sizeBytes: MAX_FESTIVAL_DOCUMENT_BYTES + 1,
    }).success).toBe(false)
    expect(festivalDocumentIdSchema.safeParse({
      festivalId: 'festival-id',
      documentId: 'document-id',
      extra: 'not allowed',
    }).success).toBe(false)
  })

  it('creates an expiring upload form and records the pending object for the scoped festival', async () => {
    const result = await createFestivalDocumentUpload({
      festivalId: 'festival-id',
      fileName: 'Festival letter.pdf',
      sizeBytes: 1234,
      contentType: 'application/pdf',
    }, 'committee-user')

    expect(result.documentId).toBe('document-id')
    expect(result.uploadUrl).toContain('storage.example.test')
    expect(mocks.createUploadUrl).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'application/pdf',
      sizeBytes: 1234,
    }))
    expect(mocks.createFestivalDocument).toHaveBeenCalledWith({}, expect.objectContaining({
      festivalId: 'festival-id',
      uploadedById: 'committee-user',
      originalName: 'Festival letter.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1234,
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_DOCUMENT_UPLOAD_STARTED',
      entity: 'FestivalDocument',
      entityId: 'document-id',
    }))
  })

  it('marks an upload ready only after the stored size and content type match', async () => {
    const result = await completeFestivalDocumentUpload('festival-id', 'document-id', 'committee-user')

    expect(result.status).toBe('READY')
    expect(mocks.markFestivalDocumentReady).toHaveBeenCalledWith({}, 'festival-id', 'document-id', expect.any(Date))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_DOCUMENT_UPLOADED',
      entityId: 'document-id',
    }))
  })

  it('rejects missing, expired, or mismatched uploads without marking them ready', async () => {
    mocks.headObject.mockResolvedValueOnce(null)
    await expect(completeFestivalDocumentUpload('festival-id', 'document-id', 'committee-user'))
      .rejects.toMatchObject({ status: 409 })

    mocks.headObject.mockResolvedValueOnce({ sizeBytes: 9, contentType: 'application/pdf' })
    await expect(completeFestivalDocumentUpload('festival-id', 'document-id', 'committee-user'))
      .rejects.toMatchObject({ status: 409 })
    expect(mocks.deleteObject).toHaveBeenCalledWith(pendingDocument.storageKey)
    expect(mocks.markFestivalDocumentReady).not.toHaveBeenCalled()

    mocks.findFestivalDocument.mockResolvedValueOnce(null)
    await expect(completeFestivalDocumentUpload('festival-id', 'foreign-document', 'committee-user'))
      .rejects.toBeInstanceOf(FestivalDocumentServiceError)

    mocks.findFestivalDocument.mockResolvedValueOnce({
      ...pendingDocument,
      uploadExpiresAt: new Date('2027-04-01T09:59:59.000Z'),
    })
    await expect(completeFestivalDocumentUpload('festival-id', 'document-id', 'committee-user'))
      .rejects.toMatchObject({ status: 409 })
  })

  it('only signs downloads for ready records and deletes storage and metadata with an audit record', async () => {
    mocks.findFestivalDocument.mockResolvedValueOnce({ ...pendingDocument, status: 'READY' })
    await expect(getFestivalDocumentDownload('festival-id', 'document-id')).resolves.toEqual({
      url: 'https://storage.example.test/signed-download',
    })
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith({
      storageKey: pendingDocument.storageKey,
      fileName: pendingDocument.originalName,
      contentType: pendingDocument.contentType,
    })

    await expect(deleteFestivalDocument('festival-id', 'document-id', 'committee-user')).resolves.toBeUndefined()
    expect(mocks.deleteObject).toHaveBeenCalledWith(pendingDocument.storageKey)
    expect(mocks.deleteFestivalDocument).toHaveBeenCalledWith({}, 'festival-id', 'document-id')
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({}, expect.objectContaining({
      action: 'FESTIVAL_DOCUMENT_DELETED',
      entityId: 'document-id',
    }))
  })
})
