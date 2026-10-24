import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
  putObjectInput: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: class {},
  GetObjectCommand: class {},
  HeadObjectCommand: class {},
  PutObjectCommand: class {
    constructor(input: unknown) {
      mocks.putObjectInput(input)
    }
  },
  S3Client: class {},
  S3ServiceException: class extends Error {},
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

import { festivalDocumentStorage } from '../src/modules/festivals/storage'

describe('festival document upload signing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.AWS_ENDPOINT_URL_S3 = 'https://storage.example.test'
    process.env.AWS_REGION = 'auto'
    process.env.AWS_BUCKET_NAME = 'festival-documents'
    mocks.getSignedUrl.mockResolvedValue('https://storage.example.test/signed-upload')
  })

  it('does not sign Content-Length, which browser fetch cannot set explicitly', async () => {
    await festivalDocumentStorage.createUploadUrl({
      storageKey: 'festivals/festival-id/document-id',
      contentType: 'image/jpeg',
    })

    expect(mocks.putObjectInput).toHaveBeenCalledWith({
      Bucket: 'festival-documents',
      Key: 'festivals/festival-id/document-id',
      ContentType: 'image/jpeg',
    })
  })
})
