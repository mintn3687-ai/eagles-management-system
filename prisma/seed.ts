import nextEnv from '@next/env'
import { randomUUID } from 'node:crypto'
import { PrismaClient, MemberStatus, RehearsalStatus } from '@prisma/client'
import { z } from 'zod'
import { hashPassword } from '../src/lib/auth/password'
import { emailSchema, passwordSchema, phoneSchema } from '../src/lib/validation'
import { parseNairobiDate } from '../src/lib/dates'

nextEnv.loadEnvConfig(process.cwd())
const prisma = new PrismaClient()

async function main() {
  const env = z.object({ SEED_ADMIN_EMAIL: emailSchema, SEED_ADMIN_PASSWORD: passwordSchema }).parse(process.env)
  const existing = await prisma.user.findUnique({ where: { email: env.SEED_ADMIN_EMAIL } })
  if (existing && existing.role !== 'SUPER_ADMIN') throw new Error('The seed admin email belongs to another role.')
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD)
  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({ where: { email: env.SEED_ADMIN_EMAIL }, update: {}, create: {
      email: env.SEED_ADMIN_EMAIL, name: 'Example Super Admin', role: 'SUPER_ADMIN', passwordHash,
    } })
    const members = [
      { name: 'Amani Otieno', email: 'amani@example.test', phone: '254700000001', status: MemberStatus.ACTIVE },
      { name: 'Neema Wanjiku', email: 'neema@example.test', phone: '254700000002', status: MemberStatus.PENDING_REGISTRATION },
      { name: 'Baraka Kiptoo', email: 'baraka@example.test', phone: '254700000003', status: MemberStatus.INACTIVE },
      { name: 'Imani Achieng', email: 'imani@example.test', phone: '254700000004', status: MemberStatus.SUSPENDED },
      { name: 'Zawadi Njeri', email: 'zawadi@example.test', phone: '254700000005', status: MemberStatus.ALUMNI },
    ]
    let activeSampleMemberId = ''
    for (const [index, sample] of members.entries()) {
      const user = await tx.user.upsert({ where: { email: emailSchema.parse(sample.email) }, update: {}, create: {
        email: sample.email, name: sample.name, role: 'MEMBER',
      } })
      const member = await tx.member.upsert({ where: { phone: phoneSchema.parse(sample.phone) }, update: {}, create: {
        userId: user.id, fullName: sample.name, email: sample.email, phone: sample.phone,
        studentRegNo: `EXAMPLE-${index + 1}`, emergencyContactName: 'Example emergency contact',
        emergencyContactPhone: phoneSchema.parse('254700000099'), status: sample.status,
        joinedAt: parseNairobiDate('2026-10-01'), notes: 'Fictional example record. No fees have been paid.',
      } })
      const currentSeason = await tx.season.findFirst({ where: { isCurrent: true }, select: { id: true } })
      if (currentSeason) {
        await tx.seasonMembership.createMany({ skipDuplicates: true, data: [{
          seasonId: currentSeason.id,
          memberId: member.id,
          status: member.status,
          feesOwed: 0,
          feesPaid: 0,
          roleInSeason: 'MEMBER',
        }] })
      }
      const statusRows = await tx.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM "MemberStatusHistory" WHERE "memberId" = ${member.id}) AS "exists"
      `
      if (!statusRows[0]?.exists) {
        const effectiveAt = member.status === MemberStatus.ACTIVE ? member.joinedAt : member.createdAt
        await tx.$executeRaw`
          INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
          VALUES (${randomUUID()}, ${member.id}, ${member.status}::"MemberStatus", ${effectiveAt})
        `
      }
      if (sample.status === MemberStatus.ACTIVE) activeSampleMemberId = member.id
    }
    for (const [index, status] of [RehearsalStatus.CLOSED, RehearsalStatus.OPEN, RehearsalStatus.SCHEDULED].entries()) {
      await tx.rehearsal.upsert({ where: { id: `example-rehearsal-${index + 1}` }, update: {}, create: {
        id: `example-rehearsal-${index + 1}`, title: `Example rehearsal ${index + 1}`,
        date: parseNairobiDate(`2026-10-${String(10 + index).padStart(2, '0')}`),
        startTime: '18:00', endTime: '20:00', venue: 'Example university hall', status, createdById: admin.id,
      } })
    }
    for (const [id, day] of [['example-analytics-excused', '08'], ['example-analytics-unreviewed', '11']]) {
      await tx.rehearsal.upsert({ where: { id }, update: {}, create: {
        id, title: id === 'example-analytics-excused' ? 'Example analytics: excused absence' : 'Example analytics: no response',
        date: parseNairobiDate(`2026-10-${day}`), startTime: '18:00', endTime: '20:00',
        venue: 'Example university hall', status: RehearsalStatus.CLOSED, createdById: admin.id,
      } })
    }
    if (activeSampleMemberId) {
      await tx.attendance.createMany({ skipDuplicates: true, data: [
        { rehearsalId: 'example-rehearsal-1', memberId: activeSampleMemberId, status: 'PRESENT', markedBy: 'SELF', markedAt: parseNairobiDate('2026-10-10', '18:10') },
        { rehearsalId: 'example-analytics-excused', memberId: activeSampleMemberId, status: 'ABSENT', markedBy: 'SELF', markedAt: parseNairobiDate('2026-10-08', '18:00'), reason: 'Example excused absence.', reviewStatus: 'EXCUSED', reviewNote: 'Example: excused.', reviewedById: admin.id, reviewedAt: parseNairobiDate('2026-10-09') },
        { rehearsalId: 'example-analytics-unreviewed', memberId: activeSampleMemberId, status: 'NO_RESPONSE', markedBy: 'COMMITTEE', markedAt: parseNairobiDate('2026-10-11', '20:00'), reviewStatus: 'PENDING' },
      ] })
    }
    // Do not upsert fee rows: the database rejects updates to fee history.
    await tx.feeSetting.createMany({ skipDuplicates: true, data: [
      { id: 'example-registration-fee', type: 'REGISTRATION', amount: 500, billingPeriod: null,
        effectiveFrom: parseNairobiDate('2026-10-01'), reason: 'EXAMPLE ONLY: registration fee, KES 500', createdById: admin.id },
      { id: 'example-subscription-fee', type: 'SUBSCRIPTION', amount: 200, billingPeriod: 'MONTHLY',
        effectiveFrom: parseNairobiDate('2026-10-01'), reason: 'EXAMPLE ONLY: monthly subscription, KES 200', createdById: admin.id },
    ] })
    for (const [key, value] of Object.entries({ clubName: 'Eagles Drama Club', timezone: 'Africa/Nairobi', currency: 'KES', attendanceThreshold: 60 })) {
      await tx.setting.upsert({ where: { key }, update: {}, create: { key, value } })
    }
  }, { timeout: 30000 })
  console.log('Seed complete: one admin, five fictional members, example rehearsals and attendance, example fees and settings. Fresh-seed analytics check for October: Amani has 3 eligible closed rehearsals (1 present, 1 excused, 1 missed), so attendance is 50%. Existing records preserved.')
}
main().catch(() => {
  console.error('Seed failed. Check database access, migrations and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (12+ characters, max 72 bytes).')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
