import nextEnv from '@next/env'
import { spawnSync } from 'node:child_process'
nextEnv.loadEnvConfig(process.cwd())
process.env.DATABASE_URL_UNPOOLED ||= process.env.DATABASE_URL
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: process.env,
})
process.exit(result.status ?? 1)
