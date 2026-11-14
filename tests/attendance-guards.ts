import assert from 'node:assert/strict'
import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../src/lib/auth/password'
nextEnv.loadEnvConfig(process.cwd())
if (process.env.ALLOW_INTEGRATION_TESTS !== 'true' || !process.env.INTEGRATION_SCHEMA) throw new Error('Use the isolated test runner.')
const db = new PrismaClient()
const base = process.env.TEST_BASE_URL!
const suffix = randomBytes(6).toString('hex')
const password = 'Test passphrase ' + suffix
class BrowserSession {
  cookies = new Map<string, string>()
  async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${base}${path}`, {
      ...init, redirect: 'manual',
      headers: { ...Object.fromEntries(new Headers(init.headers)), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]
      const split = pair.indexOf('=')
      this.cookies.set(pair.slice(0, split), pair.slice(split + 1))
    }
    return response
  }
  async login(email: string, enteredPassword = password) {
    const csrf = await (await this.request('/api/auth/csrf')).json() as { csrfToken: string }
    return this.request('/api/auth/callback/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: enteredPassword, callbackUrl: `${base}/member` }),
    })
  }
  async submitForm(path: string, marker: string, fields: Record<string, string | string[] | Blob>, existingHtml?: string) {
    const html = existingHtml ?? await (await this.request(path)).text()
    const form = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]).find((part) => part.includes(marker))
    assert.ok(form, `Form ${marker} is present on ${path}`)
    const body = new FormData()
    const decode = (v: string) => v.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
    for (const match of form.matchAll(/<input\b[^>]*>/g)) {
      const tag = match[0]
      if (!tag.includes('type="hidden"')) continue
      const name = tag.match(/name="([^"]*)"/)?.[1]
      const value = tag.match(/value="([^"]*)"/)?.[1] ?? ''
      if (name) body.append(decode(name), decode(value))
    }
    for (const [key, value] of Object.entries(fields)) { if (Array.isArray(value)) { body.delete(key); for (const item of value) body.append(key, item) } else body.set(key, value) }
    return this.request(path, { method: 'POST', headers: { Origin: base }, body })
  }
}


async function main() {
  const passwordHash = await hashPassword(password)
  const admin = await db.user.create({ data: { name: 'Committee', email: 'admin-' + suffix + '@example.test', role: 'COMMITTEE', passwordHash, consentAcceptedAt: new Date() } })
  const user = await db.user.create({ data: { name: 'Member', email: 'member-' + suffix + '@example.test', passwordHash, consentAcceptedAt: new Date() } })
  const member = await db.member.create({ data: { userId: user.id, fullName: 'Member', email: user.email, phone: '254700000091', emergencyContactName: 'Contact', emergencyContactPhone: '254700000092', status: 'ACTIVE', joinedAt: new Date('2020-01-01') } })
  const rehearsal = await db.rehearsal.create({ data: { title: 'Guard checks', date: new Date(), startTime: '00:00', endTime: '23:59', venue: 'Hall', status: 'OPEN', checkInCode: '1234', createdById: admin.id } })
  const committee = new BrowserSession(), self = new BrowserSession()
  await committee.login(admin.email)
  await self.login(user.email)
  const path = '/member/attendance?rehearsalId=' + rehearsal.id
  const adminPath = '/admin/rehearsals/' + rehearsal.id
  const html = await (await self.request(path)).text()
  await db.rehearsal.update({ where: { id: rehearsal.id }, data: { status: 'CANCELLED' } })
  let response = await self.submitForm(path, 'name="code"', { code: '1234' }, html)
  assert.equal(response.status, 200, 'Cancelled submission reaches the attendance action'); await response.text()
  response = await self.submitForm(path, 'name="reason"', { reason: 'A sufficient absence reason.' }, html)
  assert.equal(response.status, 200, 'Cancelled submission reaches the attendance action'); await response.text()
  assert.equal(await db.attendance.count(), 0)
  await db.rehearsal.update({ where: { id: rehearsal.id }, data: { status: 'CLOSED', date: new Date('2020-01-01') } })
  response = await self.submitForm(path, 'name="reason"', { reason: 'A sufficient absence reason.' }, html)
  assert.equal(response.status, 200, 'Expired submission reaches the attendance action'); await response.text()
  assert.equal(await db.attendance.count(), 0)
  await db.rehearsal.update({ where: { id: rehearsal.id }, data: { status: 'OPEN', date: new Date() } })
  await db.member.update({ where: { id: member.id }, data: { status: 'ALUMNI' } })
  response = await self.submitForm(path, 'name="code"', { code: '1234' }, html)
  assert.equal(response.status, 200, 'Inactive submission reaches the attendance action'); await response.text()
  assert.equal(await db.attendance.count(), 0)
  await db.member.update({ where: { id: member.id }, data: { status: 'ACTIVE' } })
  await db.attendance.create({ data: { rehearsalId: rehearsal.id, memberId: member.id, status: 'NO_RESPONSE', wrongCodeTries: 5 } })
  const adminHtml = await (await committee.request(adminPath)).text()
  await committee.submitForm(adminPath, 'name="memberId"', { memberId: member.id, status: 'PRESENT', note: '' }, adminHtml)
  const attendance = await db.attendance.findFirstOrThrow()
  assert.equal(attendance.status, 'PRESENT')
  assert.equal(attendance.markedBy, 'COMMITTEE')
  assert.ok(await db.auditLog.findFirst({ where: { entityId: attendance.id, action: 'ATTENDANCE_MARKED' } }))
  response = await self.submitForm(path, 'name="reason"', { reason: 'A sufficient absence reason.' }, html)
  assert.equal(response.status, 200); await response.text()
  assert.equal((await db.attendance.findFirstOrThrow()).status, 'PRESENT')
  await committee.submitForm(adminPath, 'name="memberId"', { memberId: member.id, status: 'ABSENT', note: 'Corrected paper register.' }, adminHtml)
  assert.equal((await db.attendance.findFirstOrThrow()).reviewStatus, 'PENDING')
  console.log('PASS: cancelled attendance, expired deadline, ACTIVE-only marking, required manual correction note, committee fallback and audit, immutable self PRESENT.')
}
try { await main() } catch (error) { console.error(error); process.exitCode = 1 } finally { await db.$disconnect() }
