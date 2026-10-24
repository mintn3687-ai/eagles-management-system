import 'server-only'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function storageBucket() {
  const bucket = process.env.AWS_BUCKET_NAME
  if (!bucket) throw new Error('Cloudflare R2 bucket is not configured for this environment.')
  return bucket
}

const uploadUrlExpiresSeconds = 10 * 60
const downloadUrlExpiresSeconds = 60

let client: S3Client | undefined

function encodeFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function storageClient() {
  if (client) return client

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const endpoint = process.env.AWS_ENDPOINT_URL_S3
  const region = process.env.AWS_REGION
  if (!accessKeyId || !secretAccessKey || !endpoint || !region) {
    throw new Error('Cloudflare R2 is not configured for this environment.')
  }

  client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

export const festivalDocumentStorage = {
  createUploadUrl: (input: {
    storageKey: string
    contentType: string
  }) => getSignedUrl(storageClient(), new PutObjectCommand({
    Bucket: storageBucket(),
    Key: input.storageKey,
    ContentType: input.contentType,
  }), { expiresIn: uploadUrlExpiresSeconds }),

  headObject: async (storageKey: string) => {
    try {
      const result = await storageClient().send(new HeadObjectCommand({
        Bucket: storageBucket(),
        Key: storageKey,
      }))
      return {
        sizeBytes: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
      }
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  },

  createDownloadUrl: (input: {
    storageKey: string
    fileName: string
    contentType: string
  }) => getSignedUrl(storageClient(), new GetObjectCommand({
    Bucket: storageBucket(),
    Key: input.storageKey,
    ResponseContentType: input.contentType,
    ResponseContentDisposition: `attachment; filename="${input.fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeFileName(input.fileName)}`,
  }), { expiresIn: downloadUrlExpiresSeconds }),

  deleteObject: (storageKey: string) =>
    storageClient().send(new DeleteObjectCommand({
      Bucket: storageBucket(),
      Key: storageKey,
    })),
}
