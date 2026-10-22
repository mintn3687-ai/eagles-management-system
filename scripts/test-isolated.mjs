import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

nextEnv.loadEnvConfig(process.cwd())
const schema = `phase2_test_${randomBytes(8).toString('hex')}`
const withSchema = (value) => {
  const url = new URL(value)
  url.searchParams.set('schema', schema)
  url.searchParams.set('connect_timeout', '30')
  url.searchParams.set('pool_timeout', '30')
  return url.href
}
const env = { ...process.env, DATABASE_URL: withSchema(process.env.DATABASE_URL),
  DATABASE_URL_UNPOOLED: withSchema(process.env.DATABASE_URL_UNPOOLED),
  NEXT_DIST_DIR: '.next-integration', ALLOW_INTEGRATION_TESTS: 'true', INTEGRATION_SCHEMA: schema,
  TEST_BASE_URL: 'http://localhost:3102', AUTH_URL: 'http://localhost:3102', AUTH_TRUST_HOST: 'true' }
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } } })
let server
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command failed (${code}).`)))
})
try {
  await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'])
  // Reuse only when application source has not changed since the last build.
  if (process.env.INTEGRATION_SKIP_BUILD !== 'true') await run(['node_modules/next/dist/bin/next', 'build'])
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3102'], { env, stdio: 'inherit', windowsHide: true })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.once('spawn', resolve)
  })
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Test server exited before becoming ready.')
    try { if ((await fetch(env.TEST_BASE_URL)).ok) { ready = true; break } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!ready) throw new Error('Test server did not become ready.')
  const testFile = process.env.INTEGRATION_SUITE === 'attendance-guards' ? 'tests/attendance-guards.ts' : 'tests/integration.ts'
  await run(['node_modules/tsx/dist/cli.mjs', testFile])
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => { server.once('exit', resolve); server.kill() })
  }
  // Only this run's randomly generated schema can be removed; never public.
  if (!/^phase2_test_[a-f0-9]{16}$/.test(schema)) throw new Error('Unsafe test schema')
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await db.$disconnect()
}
