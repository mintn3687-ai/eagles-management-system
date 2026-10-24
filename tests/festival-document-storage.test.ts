import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { festivalDocumentStorage } from '../src/modules/festivals/storage'

describe('festival document upload signing', () => {
  beforeEach(() => {
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.AWS_ENDPOINT_URL_S3 = 'https://storage.example.test'
    process.env.AWS_REGION = 'auto'
    process.env.AWS_BUCKET_NAME = 'festival-documents'
  })

  it('uses browser-compatible signing without content length or an empty CRC32 placeholder', async () => {
    const signedUrl = await festivalDocumentStorage.createUploadUrl({
      storageKey: 'festivals/festival-id/document-id',
      contentType: 'image/jpeg',
    })
    const url = new URL(signedUrl)

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false)
    expect(url.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false)
  })
})
