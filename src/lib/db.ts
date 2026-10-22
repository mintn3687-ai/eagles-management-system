import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // Remote database connections and serialized account updates can exceed
  // Prisma's two-second transaction acquisition default during a cold start.
  transactionOptions: { maxWait: 15000, timeout: 15000 },
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
