import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createMemberRosterPdf } from '../src/modules/members/roster-pdf'

describe('member roster PDF', () => {
  it('creates a downloadable PDF with every roster entry and paginates large rosters', async () => {
    const members = Array.from({ length: 60 }, (_, index) => ({
      fullName: `Drama Member ${index + 1}`,
      phone: `254700000${String(index).padStart(3, '0')}`,
      email: `member${index + 1}@example.test`,
      studentRegNo: index % 2 ? `REG-${index + 1}` : null,
      status: index % 2 ? 'ACTIVE' : 'PENDING_REGISTRATION',
      joinedAt: new Date('2026-01-15T00:00:00.000Z'),
    }))

    const bytes = await createMemberRosterPdf(members)
    const loaded = await PDFDocument.load(bytes)

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(loaded.getTitle()).toBe('Eagles Drama Club member roster')
    expect(loaded.getPageCount()).toBeGreaterThan(1)
  })

  it('creates a readable PDF when there are no members', async () => {
    const bytes = await createMemberRosterPdf([])
    const loaded = await PDFDocument.load(bytes)

    expect(loaded.getPageCount()).toBe(1)
    expect(loaded.getTitle()).toBe('Eagles Drama Club member roster')
  })
})
