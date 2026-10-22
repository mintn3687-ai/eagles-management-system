import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
nextEnv.loadEnvConfig(process.cwd())
const prisma = new PrismaClient()
try {
  const result = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  console.log(result)
  if (result.some((table) => table.tablename === 'Member')) {
    console.log({ members: await prisma.member.count(), administrators: await prisma.user.count({ where: { role: 'SUPER_ADMIN' } }) })
  }
} catch (error) {
  console.error(String(error).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted connection]'))
  process.exitCode = 1
} finally { await prisma.$disconnect() }
