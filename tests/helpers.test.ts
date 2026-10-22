import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeKenyanPhone, phoneSchema, kesAmountSchema, passwordSchema } from '../src/lib/validation'
import { formatKES } from '../src/lib/money'
import { nairobiDateKey, nairobiMonthBounds, parseNairobiDate } from '../src/lib/dates'
import { parseCsv, previewCsv, csvCell } from '../src/lib/members/csv'

test('phone normalization accepts only the requested Kenyan 07 format', () => {
  for (const value of ['0712345678', '+254 712 345 678', '254712345678']) assert.equal(normalizeKenyanPhone(value), '254712345678')
  for (const value of ['254112345678', '07123456789', 'abc0712345678', '447123456789', '++254712345678']) assert.equal(normalizeKenyanPhone(value), null)
  assert.equal(phoneSchema.parse('(0712) 345-678'), '254712345678')
})
test('KES helpers reject fractions, negative amounts and database integer overflow', () => {
  assert.equal(formatKES(1500), 'KES 1,500')
  assert.throws(() => formatKES(1.5))
  assert.throws(() => formatKES(-1))
  assert.equal(kesAmountSchema.safeParse(2147483648).success, false)
})
test('Nairobi date boundaries do not depend on the host timezone', () => {
  assert.equal(nairobiDateKey(new Date('2026-12-31T21:00:00Z')), '2027-01-01')
  assert.equal(parseNairobiDate('2026-10-11', '18:00').toISOString(), '2026-10-11T15:00:00.000Z')
  const bounds = nairobiMonthBounds(new Date('2026-12-31T21:00:00Z'))
  assert.equal(bounds.start.toISOString(), '2026-12-31T21:00:00.000Z')
  assert.equal(bounds.end.toISOString(), '2027-01-31T21:00:00.000Z')
  assert.throws(() => parseNairobiDate('2026-02-30'))
  assert.throws(() => parseNairobiDate('2026-10-11', '24:00'))
})
test('password length accounts for bcrypt byte truncation', () => {
  assert.equal(passwordSchema.safeParse('a useful long passphrase').success, true)
  assert.equal(passwordSchema.safeParse('a'.repeat(73)).success, false)
  assert.equal(passwordSchema.safeParse('é'.repeat(37)).success, false)
})

test('CSV supports quoted fields, BOM, CRLF and normalized duplicate detection', () => {
  const rows = previewCsv('\uFEFFfullName,phone,email,studentRegNo\r\n"Otieno, Amani",0712345678,AMANI@example.test,A1\r\nSecond Name,+254712345678,amani@example.test,\r\n')
  assert.equal(rows[0].values.fullName, 'Otieno, Amani')
  assert.equal(rows[0].values.email, 'amani@example.test')
  assert.equal(rows[1].errors.length, 2)
  assert.deepEqual(parseCsv('a,b\n"one\ntwo","quote ""inside"""'), [['a', 'b'], ['one\ntwo', 'quote "inside"']])
  assert.throws(() => parseCsv('a,b\n"unclosed,b'))
  assert.throws(() => parseCsv('a,b\n"closed"junk,b'))
  assert.throws(() => previewCsv('fullName,phone,email\nName,0712345678,x@y.test'))
})
test('CSV limits batch size and neutralizes spreadsheet formulas', () => {
  const header = 'fullName,phone,email,studentRegNo\n'
  const rows = Array.from({ length: 500 }, (_, i) => `Name ${i},2547${String(i).padStart(8, '0')},test${i}@example.test,`).join('\n')
  assert.equal(previewCsv(header + rows).length, 500)
  assert.throws(() => previewCsv(header + rows + '\nAnother,0712345678,extra@example.test,'))
  assert.throws(() => parseCsv('a'.repeat(512001)))
  assert.equal(csvCell('=HYPERLINK("example")'), '"\'=HYPERLINK(""example"")"')
})

import { countsAgainstAnalytics } from '../src/lib/absences/counting'
import { attendReasonSchema } from '../src/lib/validation/rehearsals'
import { reviewSingleSchema } from '../src/lib/validation/absences'

test('attendance counting excludes excused and present records', () => {
  for (const status of ['PRESENT', 'ABSENT', 'NO_RESPONSE'] as const) {
    for (const reviewStatus of ['NONE', 'PENDING', 'EXCUSED', 'UNEXCUSED'] as const) {
      assert.equal(countsAgainstAnalytics({ status, reviewStatus }), status !== 'PRESENT' && reviewStatus !== 'EXCUSED')
    }
  }
})
test('absence reasons and committee correction notes are validated', () => {
  assert.equal(attendReasonSchema.safeParse('   short   ').success, false)
  assert.equal(attendReasonSchema.safeParse('A sufficient reason').success, true)
  assert.equal(reviewSingleSchema.safeParse({ attendanceId: 'c123456789012345678901234', action: 'MARK_PRESENT', note: '   ' }).success, false)
})
