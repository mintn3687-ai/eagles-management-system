import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const databaseSchema = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/app').searchParams.get('schema') || 'public'
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseSchema)) throw new Error('Invalid database schema configuration.')
const rateLimitTable = Prisma.raw(`"${databaseSchema}"."RateLimitBucket"`)

export async function consumeRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex')
  const windowEndsAt = new Date(Date.now() + windowMs)
  const rows = await prisma.$queryRaw<Array<{ count: number; windowEndsAt: Date }>>`
    INSERT INTO ${rateLimitTable} ("key", "count", "windowEndsAt")
    VALUES (${key}, 1, ${windowEndsAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowEndsAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowEndsAt" = CASE WHEN "RateLimitBucket"."windowEndsAt" <= NOW() THEN EXCLUDED."windowEndsAt" ELSE "RateLimitBucket"."windowEndsAt" END
    RETURNING "count", "windowEndsAt"
  `
  if (Math.random() < 0.01) {
    await prisma.$executeRaw`
      DELETE FROM ${rateLimitTable} WHERE "key" IN (
        SELECT "key" FROM ${rateLimitTable} WHERE "windowEndsAt" < NOW() ORDER BY "windowEndsAt" LIMIT 100
      )
    `
  }
  const result = rows[0]
  return {
    allowed: result.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((result.windowEndsAt.getTime() - Date.now()) / 1000)),
  }
}

export function requestIdentity(request?: Pick<Request, 'headers'>) {
  const forwarded = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request?.headers.get('x-real-ip') || forwarded || 'unknown'
}
