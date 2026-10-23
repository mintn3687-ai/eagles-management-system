import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

export const consentRepository = {
  accept: async (userId: string, acceptedAt: Date) => prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: userId, consentAcceptedAt: null },
      data: { consentAcceptedAt: acceptedAt },
    })
    if (result.count === 1) {
      await writeAuditLog(tx, {
        actorId: userId,
        action: 'CONSENT_ACCEPTED',
        entity: 'User',
        entityId: userId,
        details: {},
      } satisfies Omit<Prisma.AuditLogUncheckedCreateInput, 'id' | 'createdAt'>)
    }
  }),
}
