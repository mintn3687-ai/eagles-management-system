import assert from 'node:assert/strict'
import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../src/lib/auth/password'
import { hashInviteToken, newInviteToken, acceptInvite } from '../src/lib/auth/invites'
import { authenticateCredentials } from '../src/lib/auth/credentials'
import { prisma as appDb } from '../src/lib/db'

nextEnv.loadEnvConfig(process.cwd())
if (process.env.ALLOW_INTEGRATION_TESTS !== 'true') throw new Error('Set ALLOW_INTEGRATION_TESTS=true only against an isolated test database.')
const db = new PrismaClient()
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const suffix = randomBytes(6).toString('hex')
const password = `Test passphrase ${suffix}`
const ids: string[] = []

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

async function createUser(role: 'MEMBER' | 'COMMITTEE' | 'SUPER_ADMIN', hasPassword = true) {
  const user = await db.user.create({ data: {
    name: `Integration ${role}`, email: `${role.toLowerCase()}-${ids.length}-${suffix}@example.test`, role,
    passwordHash: hasPassword ? await hashPassword(password) : null, consentAcceptedAt: new Date(),
  } })
  ids.push(user.id)
  return user
}

async function main() {
  const admin = await createUser('SUPER_ADMIN')
  const member = await createUser('MEMBER')
  const committee = await createUser('COMMITTEE')
  const invited = await createUser('MEMBER', false)
  const anonymous = new BrowserSession()
  const protectedPage = await anonymous.request('/admin')
  assert.ok([302, 307].includes(protectedPage.status))
  assert.match(protectedPage.headers.get('location') ?? '', /login/)
  assert.equal((await anonymous.request('/api/invites', { method: 'POST', headers: { Origin: base } })).status, 401)
  assert.equal((await anonymous.request('/api/mpesa')).status, 404)

  const memberSession = new BrowserSession()
  await memberSession.login(member.email)
  assert.equal((await memberSession.request('/member')).status, 200)
  const deniedPage = await memberSession.request('/admin')
  assert.match(deniedPage.headers.get('location') ?? '', /forbidden/)
  assert.equal((await memberSession.request('/api/invites', {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: invited.id, role: 'SUPER_ADMIN' }),
  })).status, 403)

  const adminSession = new BrowserSession()
  await adminSession.login(admin.email)
  assert.equal((await adminSession.request('/admin')).status, 200)
  const issue = () => adminSession.request('/api/invites', {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: invited.id }),
  })
  const first = await issue()
  assert.equal(first.status, 201)
  const firstInvite = await first.json() as { path: string }
  const second = await issue()
  const secondInvite = await second.json() as { path: string }
  const firstToken = firstInvite.path.split('/').at(-1)!
  const token = secondInvite.path.split('/').at(-1)!
  assert.equal(await acceptInvite({ token: firstToken, password, confirmPassword: password }), false)
  const stored = await db.invite.findUniqueOrThrow({ where: { tokenHash: hashInviteToken(token) } })
  assert.notEqual(stored.tokenHash, token)
  assert.ok(stored.expiresAt.getTime() > Date.now() + 6.9 * 86400000)
  const concurrent = await Promise.all([1, 2].map(() => acceptInvite({ token, password, confirmPassword: password })))
  assert.equal(concurrent.filter(Boolean).length, 1)
  assert.equal(await acceptInvite({ token, password, confirmPassword: password }), false)
  const inviteSession = new BrowserSession()
  await inviteSession.login(invited.email)
  assert.equal((await inviteSession.request('/member')).status, 200)

  const expiredUser = await createUser('MEMBER', false)
  const expiredToken = newInviteToken()
  await db.invite.create({ data: { userId: expiredUser.id, tokenHash: hashInviteToken(expiredToken), expiresAt: new Date(Date.now() - 1000) } })
  assert.equal(await acceptInvite({ token: expiredToken, password, confirmPassword: password }), false)

  const committeeSession = new BrowserSession()
  console.log('PASS: login, access checks and invitation acceptance.')
  await committeeSession.login(committee.email)
  assert.equal((await committeeSession.request('/admin')).status, 200)
  const privileged = await createUser('SUPER_ADMIN', false)
  assert.equal((await committeeSession.request('/api/invites', {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: privileged.id }),
  })).status, 403)
  assert.equal((await adminSession.request('/api/invites', {
    method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: expiredUser.id }),
  })).status, 403)
  assert.equal((await adminSession.request('/api/invites', {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: expiredUser.id, role: 'SUPER_ADMIN' }),
  })).status, 400)

  await db.user.update({ where: { id: committee.id }, data: { role: 'MEMBER' } })
  assert.match((await committeeSession.request('/admin')).headers.get('location') ?? '', /forbidden/)
  await db.user.update({ where: { id: member.id }, data: { consentAcceptedAt: null } })
  assert.match((await memberSession.request('/member')).headers.get('location') ?? '', /consent/)
  await memberSession.submitForm('/consent', 'name="consent"', { consent: 'on' })
  assert.ok((await db.user.findUniqueOrThrow({ where: { id: member.id } })).consentAcceptedAt)
  const profile = await db.member.create({ data: {
    userId: member.id, fullName: member.name, email: member.email, phone: `2547${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
    emergencyContactName: 'Test contact', emergencyContactPhone: '254700000099', status: 'SUSPENDED', joinedAt: new Date(),
  } })
  assert.match(await (await memberSession.request('/member')).text(), /Contact the committee/)
  await db.member.update({ where: { id: profile.id }, data: { status: 'INACTIVE' } })
  assert.match(await (await memberSession.request('/member')).text(), /Contact the committee/)
  await db.user.update({ where: { id: member.id }, data: { isActive: false } })
  assert.match((await memberSession.request('/member')).headers.get('location') ?? '', /login/)

  const lockedUser = await createUser('MEMBER')
  await Promise.all(Array.from({ length: 5 }, () => authenticateCredentials({ email: lockedUser.email, password: 'wrong password' })))
  const locked = await db.user.findUniqueOrThrow({ where: { id: lockedUser.id } })
  assert.equal(locked.failedLogins, 5)
  assert.ok(locked.lockedUntil && locked.lockedUntil.getTime() > Date.now() + 14 * 60000)
  assert.equal(await authenticateCredentials({ email: lockedUser.email, password }), null)
  await db.user.update({ where: { id: lockedUser.id }, data: { lockedUntil: new Date(Date.now() - 1000) } })
  assert.ok(await authenticateCredentials({ email: lockedUser.email, password }))
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: lockedUser.id } })).failedLogins, 0)

  const unknownAttempt = new BrowserSession()
  const wrong = await unknownAttempt.login(lockedUser.email, 'wrong password')
  const unknown = await unknownAttempt.login(`unknown-${suffix}@example.test`, 'wrong password')
  assert.equal(new URL(wrong.headers.get('location')!).search, new URL(unknown.headers.get('location')!).search)

  // Phase 2: submit real progressive-enhancement forms, including direct action calls on a public URL.
  console.log('PASS: consent, live permissions, password reset and account lockout.')
  const phone = `2547${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const details = { fullName: `Created ${suffix}`, phone, email: `created-${suffix}@example.test`, studentRegNo: 'TEST-1',
    emergencyContactName: 'Test Contact', emergencyContactPhone: '0712345678', notes: '', existingMember: 'on' }
  const creationHtml = await (await adminSession.request('/admin/members/new')).text()
  const denied = new BrowserSession()
  await denied.login(lockedUser.email)
  await denied.submitForm('/', 'name="fullName"', details, creationHtml)
  assert.equal(await db.member.count({ where: { email: details.email } }), 0)
  const createdResponse = await adminSession.submitForm('/admin/members/new', 'name="fullName"', details)
  const createdHtml = await createdResponse.text()
  const created = await db.member.findUnique({ where: { email: details.email }, include: { user: true } })
  assert.ok(created, `Member creation did not complete (HTTP ${createdResponse.status}): ${createdHtml.slice(-1200)}`)
  ids.push(created.userId!)
  assert.equal(created.status, 'ACTIVE')
  assert.equal(created.user?.role, 'MEMBER')
  assert.equal(created.emergencyContactPhone, '254712345678')
  assert.match(createdHtml, /wa\.me/)
  assert.match(createdHtml, /\/invite\/[a-f0-9]{64}/)
  const duplicateResponse = await adminSession.submitForm('/admin/members/new', 'name="fullName"', { ...details, email: `other-${suffix}@example.test` })
  assert.match(await duplicateResponse.text(), /phone number already/)
  assert.equal(await db.user.count({ where: { email: `other-${suffix}@example.test` } }), 0)
  const duplicateEmail = await adminSession.submitForm('/admin/members/new', 'name="fullName"', {
    ...details, phone: '0700000098', email: details.email.toUpperCase(),
  })
  assert.match(await duplicateEmail.text(), /email address already/)
  const pendingDetails = { ...details, fullName: `Pending ${suffix}`, phone: '0700000097', email: `pending-${suffix}@example.test` }
  const { existingMember: _existing, ...pendingFields } = pendingDetails
  await adminSession.submitForm('/admin/members/new', 'name="fullName"', pendingFields)
  const pendingMember = await db.member.findUniqueOrThrow({ where: { email: pendingFields.email } })
  ids.push(pendingMember.userId!)
  assert.equal(pendingMember.status, 'PENDING_REGISTRATION')
  const detailPath = `/admin/members/${created.id}`
  const edited = { ...details, fullName: `Edited ${suffix}`, email: `edited-${suffix}@example.test` }
  await adminSession.submitForm(detailPath, 'name="fullName"', edited)
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: created.userId! } })).email, edited.email)
  await adminSession.submitForm(detailPath, 'name="reason"', { status: 'INACTIVE', reason: '' })
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: created.id } })).status, 'ACTIVE')
  await adminSession.submitForm(detailPath, 'name="reason"', { status: 'INACTIVE', reason: 'Left the university' })
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: created.id } })).status, 'INACTIVE')
  await adminSession.submitForm(detailPath, 'name="reason"', { status: 'ACTIVE', reason: 'Returned' })
  const privilegedHtml = await (await adminSession.request(detailPath)).text()
  await db.user.update({ where: { id: committee.id }, data: { role: 'COMMITTEE' } })
  await committeeSession.submitForm('/', 'name="role"', { role: 'SUPER_ADMIN' }, privilegedHtml)
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: created.userId! } })).role, 'MEMBER')
  await denied.submitForm('/', 'name="role"', { role: 'SUPER_ADMIN' }, privilegedHtml)
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: created.userId! } })).role, 'MEMBER')
  await adminSession.submitForm(detailPath, 'name="role"', { role: 'COMMITTEE' })
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: created.userId! } })).role, 'COMMITTEE')
  const resetResponse = await adminSession.submitForm(detailPath, 'Generate invitation', {})
  const resetHtml = await resetResponse.text()
  const resetToken = resetHtml.match(/\/invite\/([a-f0-9]{64})/)?.[1]
  assert.ok(resetToken)
  await anonymous.submitForm(`/invite/${resetToken}`, 'name="confirmPassword"', { password, confirmPassword: password })
  const resetSession = new BrowserSession()
  await resetSession.login(edited.email)
  assert.match((await resetSession.request('/member')).headers.get('location') ?? '', /consent/)
  await resetSession.submitForm('/consent', 'name="consent"', { consent: 'on' })
  assert.equal((await resetSession.request('/member')).status, 200)
  const nextResetResponse = await adminSession.request('/api/invites', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: created.userId }) })
  const nextReset = await nextResetResponse.json() as { path: string }
  assert.ok(await acceptInvite({ token: nextReset.path.split('/').at(-1), password: `${password} new`, confirmPassword: `${password} new` }))
  assert.match((await resetSession.request('/member')).headers.get('location') ?? '', /login/)

  const csv = 'fullName,phone,email,studentRegNo\n' + Array.from({ length: 500 }, (_, i) =>
    `Bulk ${suffix} ${String(i).padStart(3, '0')},2547${String(80000000 + i).padStart(8, '0')},bulk-${i}-${suffix}@example.test,TEST-${i}`).join('\n')
  const preview = await adminSession.submitForm('/admin/members/import', 'name="file"', { file: new Blob([csv], { type: 'text/csv' }) })
  const previewHtml = await preview.text()
  assert.match(previewHtml, /Confirm and import this batch/)
  assert.equal(await db.member.count({ where: { email: { endsWith: `-${suffix}@example.test` }, fullName: { startsWith: 'Bulk ' } } }), 0)
  const importedResponse = await adminSession.submitForm('/admin/members/import', 'Confirm and import this batch', {}, previewHtml)
  assert.match(await importedResponse.text(), /Imported/)
  const importedUsers = await db.user.findMany({ where: { email: { endsWith: `-${suffix}@example.test` }, name: { startsWith: 'Bulk ' } }, select: { id: true } })
  ids.push(...importedUsers.map((u) => u.id))
  assert.equal(importedUsers.length, 500)
  const before = performance.now()
  const listHtml = await (await adminSession.request(`/admin/members?q=${encodeURIComponent(`Bulk ${suffix}`)}&sort=name`)).text()
  console.log(`500-member filtered list: ${Math.round(performance.now() - before)} ms; 20 rows returned.`)
  const table = listHtml.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? ''
  assert.equal([...table.matchAll(/<tr\b/g)].length, 20)
  const page2 = await (await adminSession.request(`/admin/members?q=${encodeURIComponent(`Bulk ${suffix}`)}&sort=name&page=2`)).text()
  assert.match(page2, new RegExp(`Bulk ${suffix} 020`))
  const descending = await (await adminSession.request(`/admin/members?q=${encodeURIComponent(`Bulk ${suffix}`)}&sort=name&direction=desc`)).text()
  assert.match(descending.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? '', new RegExp(`Bulk ${suffix} 499`))
  const activeExport = await adminSession.request(`/admin/members/export?q=${encodeURIComponent(suffix)}&status=ACTIVE&sort=joined&direction=desc`)
  const activeCsv = await activeExport.text()
  assert.match(activeCsv, new RegExp(`Edited ${suffix}`))
  assert.doesNotMatch(activeCsv, new RegExp(`Bulk ${suffix}|Pending ${suffix}`))
  const exported = await adminSession.request(`/admin/members/export?q=${encodeURIComponent(`Bulk ${suffix}`)}&sort=name`)
  assert.equal(exported.headers.get('content-type'), 'text/csv; charset=utf-8')
  assert.equal((await exported.text()).trim().split('\r\n').length, 501)
  const repeated = await adminSession.submitForm('/admin/members/import', 'Confirm and import this batch', {}, previewHtml)
  assert.match(await repeated.text(), /Nothing was imported/)
  assert.equal(await db.member.count({ where: { fullName: { startsWith: `Bulk ${suffix}` } } }), 500)
  const actions = (await db.auditLog.findMany({ where: { actorId: admin.id }, select: { action: true } })).map((a) => a.action)
  for (const action of ['MEMBER_CREATED', 'MEMBER_EDITED', 'MEMBER_STATUS_CHANGED', 'MEMBERS_IMPORTED', 'USER_ROLE_CHANGED']) assert.ok(actions.includes(action))
  assert.equal((await denied.request('/admin/members/export')).status, 403)

  // Phases 3 and 4: real server actions, including replay and lockout checks.
  await db.member.updateMany({ where: { userId: { in: importedUsers.slice(0, 3).map(u => u.id) } }, data: { status: 'ACTIVE', joinedAt: new Date('2020-01-01') } })
  await db.user.update({ where: { id: member.id }, data: { isActive: true } })
  await db.member.update({ where: { id: profile.id }, data: { status: 'ACTIVE', joinedAt: new Date('2020-01-01') } })
  await memberSession.login(member.email)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
  const rehearsalData = { title: 'Full flow ' + suffix, date: day, startTime: '00:00', endTime: '23:59', venue: 'Main hall' }
  await adminSession.submitForm('/admin/rehearsals', 'name="title"', rehearsalData)
  const rehearsal = await db.rehearsal.findFirstOrThrow({ where: { title: rehearsalData.title } })
  const adminPath = '/admin/rehearsals/' + rehearsal.id
  const memberPath = '/member/attendance?rehearsalId=' + rehearsal.id
  await adminSession.submitForm(adminPath, 'Open session', {})
  const opened = await db.rehearsal.findUniqueOrThrow({ where: { id: rehearsal.id } })
  assert.match(opened.checkInCode!, /^\d{4}$/)
  const checkHtml = await (await memberSession.request(memberPath)).text()
  const wrongCode = opened.checkInCode === '0000' ? '0001' : '0000'
  for (let i = 1; i <= 5; i++) {
    await memberSession.submitForm(memberPath, 'name="code"', { code: wrongCode }, checkHtml)
    assert.equal((await db.attendance.findUniqueOrThrow({ where: { rehearsalId_memberId: { rehearsalId: rehearsal.id, memberId: profile.id } } })).wrongCodeTries, i)
  }
  await memberSession.submitForm(memberPath, 'name="code"', { code: opened.checkInCode! }, checkHtml)
  const lockedAttendance = await db.attendance.findUniqueOrThrow({ where: { rehearsalId_memberId: { rehearsalId: rehearsal.id, memberId: profile.id } } })
  assert.equal(lockedAttendance.status, 'NO_RESPONSE')
  await memberSession.submitForm(memberPath, 'name="reason"', { reason: 'I am unable to attend today.' }, checkHtml)
  assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: lockedAttendance.id } })).status, 'ABSENT')
  await memberSession.submitForm(memberPath, 'name="reason"', { reason: 'This repeated reason must not replace it.' }, checkHtml)
  assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: lockedAttendance.id } })).reason, 'I am unable to attend today.')
  await adminSession.submitForm(adminPath, 'Close session', {})
  const pending = await db.attendance.findMany({ where: { rehearsalId: rehearsal.id } })
  assert.ok(pending.some(a => a.status === 'NO_RESPONSE' && a.reviewStatus === 'PENDING'))
  const reviewPath = '/admin/absences?rehearsalId=' + rehearsal.id + '&memberId=' + profile.id
  await adminSession.submitForm(reviewPath, 'name="attendanceId"', { attendanceId: lockedAttendance.id, action: 'EXCUSE', note: 'Accepted explanation.' })
  const reviewed = await db.attendance.findUniqueOrThrow({ where: { id: lockedAttendance.id } })
  assert.equal(reviewed.reviewStatus, 'EXCUSED')
  assert.equal(reviewed.reviewedById, admin.id)
  assert.ok(reviewed.reviewedAt)
  assert.match(await (await memberSession.request('/member/history')).text(), /Accepted explanation/)
  assert.ok(await db.auditLog.findFirst({ where: { entityId: reviewed.id, action: 'ABSENCE_REVIEWED' } }))

  // A fresh rehearsal verifies valid check-in, transition rules and direct-action guards.
  const secondRehearsal = await db.rehearsal.create({ data: { title: 'Transitions ' + suffix, date: rehearsal.date, startTime: '00:00', endTime: '23:59', venue: 'Hall', createdById: admin.id } })
  const secondAdmin = '/admin/rehearsals/' + secondRehearsal.id
  const secondMember = '/member/attendance?rehearsalId=' + secondRehearsal.id
  const absentHtml = await (await memberSession.request(secondMember)).text()
  await memberSession.submitForm(secondMember, 'name="reason"', { reason: 'short' }, absentHtml)
  assert.equal(await db.attendance.count({ where: { rehearsalId: secondRehearsal.id, memberId: profile.id } }), 0)
  await memberSession.submitForm(secondMember, 'name="reason"', { reason: 'Travel delay this evening.' }, absentHtml)
  await adminSession.submitForm(secondAdmin, 'Open session', {})
  const secondCode = (await db.rehearsal.findUniqueOrThrow({ where: { id: secondRehearsal.id } })).checkInCode!
  const presentHtml = await (await memberSession.request(secondMember)).text()
  for (const status of ['PENDING_REGISTRATION', 'ALUMNI', 'SUSPENDED', 'INACTIVE'] as const) {
    await db.member.update({ where: { id: profile.id }, data: { status } })
    await memberSession.submitForm(secondMember, 'name="code"', { code: secondCode }, presentHtml)
    assert.equal((await db.attendance.findUniqueOrThrow({ where: { rehearsalId_memberId: { rehearsalId: secondRehearsal.id, memberId: profile.id } } })).status, 'ABSENT')
  }
  await db.member.update({ where: { id: profile.id }, data: { status: 'ACTIVE' } })
  await memberSession.submitForm(secondMember, 'name="code"', { code: secondCode }, presentHtml)
  const presentRecord = await db.attendance.findUniqueOrThrow({ where: { rehearsalId_memberId: { rehearsalId: secondRehearsal.id, memberId: profile.id } } })
  assert.equal(presentRecord.status, 'PRESENT')
  await memberSession.submitForm(secondMember, 'name="reason"', { reason: 'Cannot overwrite present.' }, absentHtml)
  assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: presentRecord.id } })).status, 'PRESENT')
  const noResponse = pending.find(a => a.status === 'NO_RESPONSE')!
  const correctionPath = '/admin/absences?rehearsalId=' + rehearsal.id + '&memberId=' + noResponse.memberId
  const correctionHtml = await (await adminSession.request(correctionPath)).text()
  await adminSession.submitForm(correctionPath, 'name="attendanceId"', { attendanceId: noResponse.id, action: 'MARK_PRESENT', note: '' }, correctionHtml)
  assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: noResponse.id } })).status, 'NO_RESPONSE')
  await adminSession.submitForm(correctionPath, 'name="attendanceId"', { attendanceId: noResponse.id, action: 'MARK_PRESENT', note: 'Paper register confirms attendance.' }, correctionHtml)
  const corrected = await db.attendance.findUniqueOrThrow({ where: { id: noResponse.id } })
  assert.equal(corrected.status, 'PRESENT')
  assert.equal(corrected.markedBy, 'COMMITTEE')
  assert.equal(corrected.reviewStatus, 'NONE')
  await adminSession.submitForm(secondAdmin, 'name="reason"', { reason: 'Cancelled for testing.' })
  assert.equal((await db.rehearsal.findUniqueOrThrow({ where: { id: secondRehearsal.id } })).status, 'CANCELLED')
  await memberSession.submitForm(secondMember, 'name="code"', { code: secondCode }, presentHtml)
  assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: presentRecord.id } })).status, 'PRESENT')

  const expired = await db.rehearsal.create({ data: { title: 'Expired ' + suffix, date: new Date('2020-01-01T00:00:00+03:00'), startTime: '18:00', endTime: '20:00', venue: 'Hall', status: 'CLOSED', createdById: admin.id } })
  await memberSession.submitForm(secondMember, 'name="reason"', { rehearsalId: expired.id, reason: 'Late explanation must be rejected.' }, absentHtml)
  assert.equal(await db.attendance.count({ where: { rehearsalId: expired.id } }), 0)
  await memberSession.submitForm(secondMember, 'name="reason"', { rehearsalId: secondRehearsal.id, reason: 'Cancelled rehearsal must reject this.' }, absentHtml)
  const remaining = pending.filter(a => a.status === 'NO_RESPONSE' && a.id !== noResponse.id)
  assert.equal(remaining.length, 2)
  if (remaining.length) {
    await adminSession.submitForm('/admin/absences?rehearsalId=' + rehearsal.id, 'id="bulk-review"', { attendanceIds: remaining.map(a => a.id), action: 'UNEXCUSE', note: 'No explanation received.' })
    for (const item of remaining) assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: item.id } })).reviewStatus, 'UNEXCUSED')
  }
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Nairobi', weekday: 'long' }).format(new Date())
  const weeklyPreviewResponse = await adminSession.submitForm('/admin/rehearsals/generate', 'name="weekday"', { weekday, startDate: day, endDate: day, startTime: '18:00', endTime: '20:00', venue: 'Weekly hall' })
  const weeklyHtml = await weeklyPreviewResponse.text()
  assert.match(weeklyHtml, /Confirm and create/)
  await adminSession.submitForm('/admin/rehearsals/generate', 'Confirm and create', {}, weeklyHtml)
  assert.equal(await db.rehearsal.count({ where: { venue: 'Weekly hall', date: rehearsal.date } }), 1)
  console.log('PASS: rehearsal create/open/close, persistent five-attempt lockout, single absence submission, pending no-response generation, review audit and member history.')
  console.log('PASS: authentication, invite/reset races, consent, live permissions, lockout, member forms, audit logs, CSV import/export and 500-member pagination.')
}

try { await main() }
catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
finally {
  // The isolated runner stops the server before dropping its whole schema,
  // avoiding races with authentication audit writes still finishing in HTTP handlers.
  const isolatedSchema = process.env.INTEGRATION_SCHEMA
  const runnerOwnsCleanup = isolatedSchema && /^phase2_test_[a-f0-9]{16}$/.test(isolatedSchema)
    && new URL(process.env.DATABASE_URL!).searchParams.get('schema') === isolatedSchema
  if (!runnerOwnsCleanup) {
  const remaining = await db.user.findMany({ where: { email: { endsWith: `-${suffix}@example.test` } }, select: { id: true } })
  ids.push(...remaining.map((user) => user.id))
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } })
  await db.invite.deleteMany({ where: { userId: { in: ids } } })
  await db.member.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.$disconnect()
  await appDb.$disconnect()
}
