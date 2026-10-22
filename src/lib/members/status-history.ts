import 'server-only'
import { randomUUID } from 'node:crypto'
import { type MemberStatus, Prisma } from '@prisma/client'

export async function recordMemberStatusChange(
  tx: Prisma.TransactionClient,
  memberId: string,
  from: MemberStatus,
  to: MemberStatus,
  effectiveAt: Date,
) {
  if (from === to) return
  await tx.$executeRaw`
    INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
    VALUES (${randomUUID()}, ${memberId}, ${to}::"MemberStatus", ${effectiveAt})
  `
}

export async function recordInitialMemberStatus(
  tx: Prisma.TransactionClient,
  memberId: string,
  status: MemberStatus,
  effectiveAt: Date,
) {
  await tx.$executeRaw`
    INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
    VALUES (${randomUUID()}, ${memberId}, ${status}::"MemberStatus", ${effectiveAt})
  `
}
