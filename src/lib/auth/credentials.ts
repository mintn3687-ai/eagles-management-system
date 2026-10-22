import { lockRow } from '../row-lock'
import { prisma } from '../db'
import { loginSchema } from '../validation/auth'
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password'
import { passwordVersion } from './password-version'
import { consumeRateLimit, requestIdentity } from '../rate-limit'

export async function authenticateCredentials(input: unknown, request?: Pick<Request, 'headers'>) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return null
  const ip = requestIdentity(request)
  const [ipLimit, accountLimit] = await Promise.all([
    consumeRateLimit('login-ip', ip, 30, 15 * 60_000),
    consumeRateLimit('login-account', parsed.data.email, 10, 15 * 60_000),
  ])
  if (!ipLimit.allowed || !accountLimit.allowed) return null
  const initial = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const valid = await verifyPassword(parsed.data.password, initial?.passwordHash ?? DUMMY_PASSWORD_HASH)
  if (!initial) return null

  // Serialize attempts per account so concurrent wrong passwords cannot lose increments.
  // bcrypt runs before the lock to keep the transaction short.
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'User', initial.id)
    const user = await tx.user.findUnique({ where: { id: initial.id } })
    const now = new Date()
    if (!user?.isActive || !user.passwordHash || user.passwordHash !== initial.passwordHash ||
        (user.lockedUntil && user.lockedUntil > now)) return null
    if (!valid) {
      const failedLogins = user.lockedUntil ? 1 : user.failedLogins + 1
      await tx.user.update({ where: { id: user.id }, data: {
        failedLogins,
        lockedUntil: failedLogins >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null,
      } })
      return null
    }
    await tx.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
    return { id: user.id, name: user.name, email: user.email, passwordVersion: passwordVersion(user.passwordHash) }
  })
}
