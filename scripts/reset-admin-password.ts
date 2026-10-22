import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { emailSchema, passwordSchema } from '../src/lib/validation'
import { hashPassword } from '../src/lib/auth/password'

nextEnv.loadEnvConfig(process.cwd())

async function askLine(prompt: string) {
  const readline = createInterface({ input: stdin, output: stdout })
  try {
    return (await readline.question(prompt)).trim()
  } finally {
    readline.close()
  }
}

async function askSecret(prompt: string) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal.')
  }

  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise<string>((resolve, reject) => {
    let value = ''
    const finish = (error?: Error) => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('Cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else {
          value += character
        }
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required.')

  const database = new URL(databaseUrl)
  const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''))
  const endpoint = `${database.hostname}/${databaseName}`
  console.log(`Target database: ${endpoint}`)
  console.log('This command only resets an existing SUPER_ADMIN account password.')

  const email = emailSchema.parse(await askLine('Admin email: '))
  console.log(`Account to reset: ${email}`)
  console.log(`Database target: ${endpoint}`)
  const confirmation = await askLine('Type RESET to confirm this account and database: ')
  if (confirmation !== 'RESET') {
    throw new Error('Confirmation did not match; no changes were made.')
  }

  const password = passwordSchema.parse(await askSecret('New password (input hidden): '))
  const repeatedPassword = await askSecret('Repeat new password: ')
  if (password !== repeatedPassword) throw new Error('Passwords did not match; no changes were made.')

  const prisma = new PrismaClient()
  try {
    const admin = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true },
    })
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      throw new Error('No SUPER_ADMIN account was found for that email; no changes were made.')
    }
    if (!admin.isActive) {
      throw new Error('The SUPER_ADMIN account is inactive. No changes were made; have an authorized administrator reactivate it.')
    }

    const result = await prisma.user.updateMany({
      where: { id: admin.id, role: 'SUPER_ADMIN', isActive: true },
      data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    })
    if (result.count !== 1) throw new Error('The account changed during reset; no changes were made.')
    console.log('Password reset successfully. Sign in with the new password.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error.'
  console.error(`Admin password reset failed: ${message}`)
  process.exitCode = 1
})
