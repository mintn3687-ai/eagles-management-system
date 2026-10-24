import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createFestivalProposalPdf } from '../src/modules/festivals/proposal-pdf'
import type { getFestival, getFestivalPlanning } from '../src/modules/festivals/service'

describe('festival proposal PDF', () => {
  it('creates a readable PDF from the full festival planning data shape', async () => {
    const festival = {
      id: 'festival-id',
      name: 'National Drama Festival',
      year: 2027,
      organizer: 'University',
      venue: 'Nairobi',
      startDate: new Date('2027-04-01T00:00:00.000Z'),
      endDate: new Date('2027-04-05T00:00:00.000Z'),
      status: 'PLANNING',
      notes: 'Proposal notes',
      createdById: 'admin-id',
      createdAt: new Date('2027-01-01T00:00:00.000Z'),
      updatedAt: new Date('2027-01-01T00:00:00.000Z'),
    } satisfies NonNullable<Awaited<ReturnType<typeof getFestival>>>
    const planning = {
      categories: [],
      invitations: [],
      entries: [],
      budgetItems: [],
      logisticsItems: [],
      logisticsAssigneeOptions: [],
      festivalDocuments: [],
      unlinkedFinanceEntries: [],
      productionOptions: [],
      planApproval: null,
      approvalHistory: [],
      budgetSummary: {
        INCOME: { planned: 0, approved: 0, actual: 0 },
        EXPENSE: { planned: 0, approved: 0, actual: 0 },
      },
    } satisfies Awaited<ReturnType<typeof getFestivalPlanning>>

    const bytes = await createFestivalProposalPdf({ festival, planning })
    const loaded = await PDFDocument.load(bytes)

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(loaded.getTitle()).toBe('National Drama Festival festival proposal')
    expect(loaded.getPageCount()).toBeGreaterThan(0)
  })
})
