import { describe, expect, it } from 'vitest'
import {
  assetMovementSchema,
  callSheetSchema,
  productionCreateSchema,
  showDateSchema,
} from '../src/modules/productions/schema'
import {
  validateAssetCheckin,
  validateAssetCheckout,
  validateProductionTransition,
  validateTaskTransition,
} from '../src/modules/productions/rules'

const id = 'c123456789012345678901234'

describe('production input validation', () => {
  it('rejects an end date before the production start date', () => {
    const result = productionCreateSchema.safeParse({
      title: 'Annual play',
      description: '',
      startDate: '2026-11-10',
      endDate: '2026-11-09',
    })
    expect(result.success).toBe(false)
  })

  it('rejects impossible dates and malformed show times', () => {
    expect(showDateSchema.safeParse({
      productionId: id, date: '2026-02-30', startTime: '18:00', venue: 'Main hall',
    }).success).toBe(false)
    expect(showDateSchema.safeParse({
      productionId: id, date: '2026-02-28', startTime: '25:00', venue: 'Main hall',
    }).success).toBe(false)
  })

  it('rejects a duplicate member in a call sheet and missing checkout member', () => {
    expect(callSheetSchema.safeParse({
      productionId: id, showDateId: id, title: 'Evening call', callDate: '2026-11-01',
      callTime: '16:00', notes: '', memberIds: [id, id],
    }).success).toBe(false)
    expect(assetMovementSchema.safeParse({ assetId: id, memberId: '' }).success).toBe(true)
  })
})

describe('production lifecycle and asset rules', () => {
  it('allows only forward production and task status transitions', () => {
    expect(() => validateProductionTransition('PLANNING', 'ACTIVE')).not.toThrow()
    expect(() => validateProductionTransition('COMPLETED', 'ACTIVE')).toThrow(/move forward/)
    expect(() => validateTaskTransition('OPEN', 'IN_PROGRESS')).not.toThrow()
    expect(() => validateTaskTransition('COMPLETED', 'OPEN')).toThrow(/cannot be reopened/)
  })

  it('allows checkout only when available and check-in only when checked out', () => {
    expect(() => validateAssetCheckout('AVAILABLE')).not.toThrow()
    expect(() => validateAssetCheckout('CHECKED_OUT')).toThrow(/already checked out/)
    expect(() => validateAssetCheckin('CHECKED_OUT')).not.toThrow()
    expect(() => validateAssetCheckin('AVAILABLE')).toThrow(/Only a checked-out asset/)
  })
})
