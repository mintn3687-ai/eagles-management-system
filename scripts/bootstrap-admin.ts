import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { emailSchema, passwordSchema } from '../src/lib/validation'
import { hashPassword } from '../src/lib/auth/password'

nextEnv.loadEnvConfig(process.cwd())
const db = new PrismaClient()
try {
  const email = emailSchema.parse(process.env.SEED_ADMIN_EMAIL)
  const password = passwordSchema.parse(process.env.SEED_ADMIN_PASSWORD)
  const existing = await db.user.findUnique({ where: { email } })
  if (existing && existing.role !== 'SUPER_ADMIN') throw new Error('Configured email already belongs to another role.')
  if (!existing) {
    await db.user.create({ data: { email, name: 'Club administrator', role: 'SUPER_ADMIN', passwordHash: await hashPassword(password) } })
  }
  console.log(existing ? 'Administrator already exists; credentials preserved.' : 'Administrator created using configured seed credentials. No example members added.')
} catch {
  console.error('Administrator setup failed. Check migrations and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.')
  process.exitCode = 1
} finally { await db.$disconnect() }
