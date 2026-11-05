import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  memberForPayment: vi.fn(),
  effectiveFee: vi.fn(),
  latestSuccessfulSubscription: vi.fn(),
  hasPendingMemberPayment: vi.fn(),
  hasPendingEventPayment: vi.fn(),
  hasSuccessfulEventPayment: vi.fn(),
  openPaymentEventForCheckout: vi.fn(),
  createPaymentEvent: vi.fn(),
  paymentEventForUpdate: vi.fn(),
  updatePaymentEventStatus: vi.fn(),
  findPaymentByReference: vi.fn(),
  findPaymentRequest: vi.fn(),
  createPaymentRequest: vi.fn(),
  findPayHeroPayment: vi.fn(),
  updatePayHeroCheckout: vi.fn(),
  failPendingPayHeroCheckout: vi.fn(),
  paymentForReview: vi.fn(),
  updatePaymentReview: vi.fn(),
  memberPaymentHistory: vi.fn(),
  billingPeriodSetting: vi.fn(),
  activateMember: vi.fn(),
  recordStatusChange: vi.fn(),
  findSeasonAt: vi.fn(),
  assignPaymentToSeason: vi.fn(),
  upsertMembershipPayment: vi.fn(),
  lockRow: vi.fn(),
  writeAuditLog: vi.fn(),
  syncCurrentSeasonMemberStatus: vi.fn(),
  initiatePayHeroCheckout: vi.fn(),
  getPayHeroTransactionStatus: vi.fn(),
  isPayHeroConfigured: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/row-lock', () => ({ lockRow: mocks.lockRow }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('@/modules/members/repository', () => ({
  memberDetailsRepository: {
    activateMember: mocks.activateMember,
    recordStatusChange: mocks.recordStatusChange,
  },
}))
vi.mock('@/modules/seasons/service', () => ({
  syncCurrentSeasonMemberStatus: mocks.syncCurrentSeasonMemberStatus,
}))
vi.mock('../src/modules/finance/payhero-client', () => ({
  initiatePayHeroCheckout: mocks.initiatePayHeroCheckout,
  getPayHeroTransactionStatus: mocks.getPayHeroTransactionStatus,
  isPayHeroConfigured: mocks.isPayHeroConfigured,
  PayHeroError: class PayHeroError extends Error {
    rejected: boolean
    constructor(message: string, rejected = false) {
      super(message)
      this.rejected = rejected
    }
  },
}))
vi.mock('../src/modules/finance/repository', () => ({
  financeRepository: {
    transaction: mocks.transaction,
    memberForPayment: mocks.memberForPayment,
    effectiveFee: mocks.effectiveFee,
    latestSuccessfulSubscription: mocks.latestSuccessfulSubscription,
    hasPendingMemberPayment: mocks.hasPendingMemberPayment,
    hasPendingEventPayment: mocks.hasPendingEventPayment,
    hasSuccessfulEventPayment: mocks.hasSuccessfulEventPayment,
    openPaymentEventForCheckout: mocks.openPaymentEventForCheckout,
    createPaymentEvent: mocks.createPaymentEvent,
    paymentEventForUpdate: mocks.paymentEventForUpdate,
    updatePaymentEventStatus: mocks.updatePaymentEventStatus,
    findPaymentByReference: mocks.findPaymentByReference,
    findPaymentRequest: mocks.findPaymentRequest,
    createPaymentRequest: mocks.createPaymentRequest,
    findPayHeroPayment: mocks.findPayHeroPayment,
    updatePayHeroCheckout: mocks.updatePayHeroCheckout,
    failPendingPayHeroCheckout: mocks.failPendingPayHeroCheckout,
    paymentForReview: mocks.paymentForReview,
    updatePaymentReview: mocks.updatePaymentReview,
    memberPaymentHistory: mocks.memberPaymentHistory,
    billingPeriodSetting: mocks.billingPeriodSetting,
    activateMember: mocks.activateMember,
    recordStatusChange: mocks.recordStatusChange,
  },
  seasonPaymentsRepository: {
    findSeasonAt: mocks.findSeasonAt,
    assignPaymentToSeason: mocks.assignPaymentToSeason,
    upsertMembershipPayment: mocks.upsertMembershipPayment,
  },
}))

import {
  feeSettingInputSchema,
  memberPaymentRequestSchema,
  paymentEventCreateSchema,
  paymentListSchema,
} from '../src/lib/validation/fees'
import { paymentWhere } from '../src/lib/payments-query'
import {
  initiatePayHeroMemberPayment,
  initiatePayHeroEventPayment,
  processPayHeroCallback,
  recordManualPayment,
  reviewMemberPayment,
  submitMemberPayment,
} from '../src/modules/finance/service'
import { nairobiDateKey } from '../src/lib/dates'

const memberId = 'c123456789012345678901234'
const paymentId = 'c234567890123456789012345'
const actorId = 'c345678901234567890123456'
const tx = { setting: { findUnique: vi.fn().mockResolvedValue(null) } }

describe('member payment claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (work) => work(tx))
    mocks.memberForPayment.mockResolvedValue({ id: memberId, fullName: 'Test Member', phone: '0712345678', status: 'ACTIVE' })
    mocks.effectiveFee.mockResolvedValue({ amount: 750, billingPeriod: 'MONTHLY' })
    mocks.latestSuccessfulSubscription.mockResolvedValue(null)
    mocks.hasPendingMemberPayment.mockResolvedValue(null)
    mocks.hasPendingEventPayment.mockResolvedValue(null)
    mocks.hasSuccessfulEventPayment.mockResolvedValue(null)
    mocks.openPaymentEventForCheckout.mockResolvedValue({
      id: 'c456789012345678901234567', title: 'Drama Festival Trip', amount: 1800,
    })
    mocks.findPaymentByReference.mockResolvedValue(null)
    mocks.findPaymentRequest.mockResolvedValue(null)
    mocks.createPaymentRequest.mockResolvedValue({ id: paymentId, status: 'PENDING' })
    mocks.findPayHeroPayment.mockResolvedValue({
      id: paymentId, memberId, type: 'RETREAT_BONDING', amount: 750, phone: '254712345678',
      reference: 'EDC-123', status: 'PENDING', source: 'PAYHERO_CHECKOUT', recordedById: actorId,
    })
    mocks.updatePayHeroCheckout.mockResolvedValue({})
    mocks.failPendingPayHeroCheckout.mockResolvedValue({ count: 1 })
    mocks.initiatePayHeroCheckout.mockResolvedValue('checkout-123')
    mocks.getPayHeroTransactionStatus.mockResolvedValue({
      reference: 'EDC-123', status: 'SUCCESS', amount: 750, receipt: 'QWERTY123', description: 'Success',
    })
    mocks.isPayHeroConfigured.mockReturnValue(true)
    mocks.findSeasonAt.mockResolvedValue(null)
    mocks.paymentForReview.mockResolvedValue({
      id: paymentId, memberId, type: 'RETREAT_BONDING', amount: 750, method: 'MPESA',
      reference: 'ABC123', status: 'PENDING', source: 'MEMBER_REPORTED',
    })
  })

  it.each([
    ['REGISTRATION', 'PENDING_REGISTRATION'],
    ['SUBSCRIPTION', 'ACTIVE'],
    ['RETREAT_BONDING', 'ACTIVE'],
  ] as const)('creates a pending server-priced %s claim', async (type, status) => {
    mocks.memberForPayment.mockResolvedValue({ id: memberId, status })
    const result = await submitMemberPayment({
      memberId, type, method: 'MPESA', reference: ' ABC123 ',
    }, actorId)

    expect(result).toMatchObject({ paymentId, status: 'PENDING', duplicate: false })
    expect(mocks.createPaymentRequest).toHaveBeenCalledWith(tx, expect.objectContaining({
      memberId, type, amount: 750, method: 'MPESA', reference: 'ABC123',
      status: 'PENDING', source: 'MEMBER_REPORTED', recordedById: actorId,
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'MEMBER_PAYMENT_SUBMITTED', entityId: paymentId,
    }))
  })

  it('returns an existing claim for the same payment reference without creating another', async () => {
    mocks.findPaymentRequest.mockResolvedValue({ id: paymentId, status: 'PENDING' })
    await expect(submitMemberPayment({
      memberId, type: 'RETREAT_BONDING', method: 'MPESA', reference: 'abc123',
    }, actorId)).resolves.toEqual({ paymentId, status: 'PENDING', duplicate: true })
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('does not create another member claim for a previously recorded reference', async () => {
    mocks.findPaymentByReference.mockResolvedValue({ id: paymentId, status: 'SUCCESS' })
    await expect(submitMemberPayment({
      memberId, type: 'RETREAT_BONDING', method: 'MPESA', reference: 'ABC123',
    }, actorId)).resolves.toEqual({ paymentId, status: 'SUCCESS', duplicate: true })
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('prevents a repeated manual payment reference from creating a second record', async () => {
    mocks.findPaymentByReference.mockResolvedValue({ id: paymentId, status: 'SUCCESS' })
    await expect(recordManualPayment({
      memberId, type: 'RETREAT_BONDING', method: 'CASH',
      reference: 'ABC123', paymentDate: nairobiDateKey(), reason: 'Cash verified.',
    }, actorId)).rejects.toThrow(/already been recorded/)
  })

  it('blocks a second different reference while the same fee has a pending claim', async () => {
    mocks.hasPendingMemberPayment.mockResolvedValue({ id: paymentId })
    await expect(submitMemberPayment({
      memberId, type: 'RETREAT_BONDING', method: 'MPESA', reference: 'XYZ789',
    }, actorId)).rejects.toThrow(/awaiting committee review/)
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('blocks a second subscription claim while the current paid period and grace window remain active', async () => {
    mocks.latestSuccessfulSubscription.mockResolvedValue({ periodEnd: new Date(Date.now() + 86400000), paidAt: new Date() })
    await expect(submitMemberPayment({
      memberId, type: 'SUBSCRIPTION', method: 'MPESA', reference: 'NEXT123',
    }, actorId)).rejects.toThrow(/already paid/)
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('creates a server-priced pending PayHero checkout and stores its provider request ID', async () => {
    const result = await initiatePayHeroMemberPayment({
      memberId, type: 'RETREAT_BONDING', phone: '0712345678',
    }, actorId)

    expect(result).toEqual({ paymentId, duplicate: false })
    expect(mocks.createPaymentRequest).toHaveBeenCalledWith(tx, expect.objectContaining({
      memberId, type: 'RETREAT_BONDING', amount: 750, method: 'MPESA', phone: '0712345678',
      status: 'PENDING', source: 'PAYHERO_CHECKOUT', recordedById: actorId,
      reference: expect.stringMatching(/^EDC-/),
    }))
    expect(mocks.initiatePayHeroCheckout).toHaveBeenCalledWith(expect.objectContaining({
      amount: 750, phone: '0712345678', customerName: 'Test Member',
    }))
    expect(mocks.updatePayHeroCheckout).toHaveBeenCalledWith(
      tx, paymentId, 'checkout-123', 'M-Pesa prompt sent. Waiting for PayHero confirmation.',
    )
  })

  it('does not send a second STK prompt when a fee already has a pending payment', async () => {
    mocks.hasPendingMemberPayment.mockResolvedValue({ id: paymentId })
    await expect(initiatePayHeroMemberPayment({
      memberId, type: 'RETREAT_BONDING', phone: '0712345678',
    }, actorId)).resolves.toEqual({ paymentId, duplicate: true })
    expect(mocks.initiatePayHeroCheckout).not.toHaveBeenCalled()
  })

  it('creates a separate server-priced event checkout for an eligible member', async () => {
    const eventId = 'c456789012345678901234567'
    await expect(initiatePayHeroEventPayment({
      memberId, eventId, phone: '0712345678',
    }, actorId)).resolves.toEqual({ paymentId, duplicate: false })
    expect(mocks.lockRow).toHaveBeenCalledWith(tx, 'PaymentEvent', eventId)
    expect(mocks.createPaymentRequest).toHaveBeenCalledWith(tx, expect.objectContaining({
      memberId, paymentEventId: eventId, type: 'EVENT', amount: 1800,
      method: 'MPESA', status: 'PENDING', source: 'PAYHERO_CHECKOUT',
    }))
    expect(mocks.initiatePayHeroCheckout).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1800, phone: '0712345678', customerName: 'Test Member',
    }))
  })

  it('prevents duplicate and closed event checkouts', async () => {
    mocks.hasPendingEventPayment.mockResolvedValue({ id: paymentId })
    await expect(initiatePayHeroEventPayment({
      memberId, eventId: 'c456789012345678901234567', phone: '0712345678',
    }, actorId)).resolves.toEqual({ paymentId, duplicate: true })
    expect(mocks.initiatePayHeroCheckout).not.toHaveBeenCalled()

    mocks.hasPendingEventPayment.mockResolvedValue(null)
    mocks.openPaymentEventForCheckout.mockResolvedValue(null)
    await expect(initiatePayHeroEventPayment({
      memberId, eventId: 'c456789012345678901234567', phone: '0712345678',
    }, actorId)).rejects.toThrow(/closed or its payment deadline has passed/)
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('does not create another checkout after an event payment succeeded', async () => {
    mocks.hasSuccessfulEventPayment.mockResolvedValue({ id: paymentId })
    await expect(initiatePayHeroEventPayment({
      memberId, eventId: 'c456789012345678901234567', phone: '0712345678',
    }, actorId)).rejects.toThrow(/already paid for this event/)
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('does not assign a confirmed event payment to member season fees', async () => {
    mocks.findPayHeroPayment.mockResolvedValue({
      id: paymentId, memberId, type: 'EVENT', amount: 1800, phone: '0712345678',
      reference: 'EDC-EVT-123', status: 'PENDING', source: 'PAYHERO_CHECKOUT',
      recordedById: actorId, paymentEventId: 'c456789012345678901234567',
    })
    mocks.getPayHeroTransactionStatus.mockResolvedValue({
      reference: 'EDC-EVT-123', status: 'SUCCESS', amount: 1800,
      receipt: 'EVENT123', description: 'Success',
    })
    await expect(processPayHeroCallback('EDC-EVT-123')).resolves.toMatchObject({
      paymentId, status: 'SUCCESS', duplicate: false,
    })
    expect(mocks.findSeasonAt).not.toHaveBeenCalled()
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({
      status: 'SUCCESS', source: 'PROVIDER_VERIFIED', mpesaReceipt: 'EVENT123',
    }))
  })

  it('settles only provider-confirmed payments and stores the provider receipt', async () => {
    await expect(processPayHeroCallback('EDC-123')).resolves.toMatchObject({
      paymentId, status: 'SUCCESS', duplicate: false,
    })
    expect(mocks.getPayHeroTransactionStatus).toHaveBeenCalledWith('EDC-123')
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({
      status: 'SUCCESS', source: 'PROVIDER_VERIFIED', mpesaReceipt: 'QWERTY123',
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'PAYHERO_PAYMENT_VERIFIED',
    }))
  })

  it('leaves PayHero checkouts pending until the status API confirms completion', async () => {
    mocks.getPayHeroTransactionStatus.mockResolvedValue({
      reference: 'EDC-123', status: 'PENDING', amount: 750, receipt: null, description: 'Processing',
    })
    await expect(processPayHeroCallback('EDC-123')).resolves.toMatchObject({ status: 'PENDING', duplicate: false })
    expect(mocks.updatePaymentReview).not.toHaveBeenCalled()
  })

  it('rejects mismatched PayHero amount or reference without settling', async () => {
    mocks.getPayHeroTransactionStatus.mockResolvedValue({
      reference: 'EDC-OTHER', status: 'SUCCESS', amount: 700, receipt: 'QWERTY123', description: 'Success',
    })
    await expect(processPayHeroCallback('EDC-123')).rejects.toThrow(/reference did not match/)
    expect(mocks.updatePaymentReview).not.toHaveBeenCalled()
    mocks.getPayHeroTransactionStatus.mockResolvedValue({
      reference: 'EDC-123', status: 'SUCCESS', amount: 700, receipt: 'QWERTY123', description: 'Success',
    })
    await expect(processPayHeroCallback('EDC-123')).rejects.toThrow(/matching amount and receipt/)
    expect(mocks.updatePaymentReview).not.toHaveBeenCalled()
  })

  it('rejects membership payments when the member status does not qualify', async () => {
    mocks.memberForPayment.mockResolvedValue({ id: memberId, status: 'ACTIVE' })
    await expect(submitMemberPayment({
      memberId, type: 'REGISTRATION', method: 'MPESA', reference: 'ABC123',
    }, actorId)).rejects.toThrow(/not eligible/)
    expect(mocks.createPaymentRequest).not.toHaveBeenCalled()
  })

  it('requires confirmation and a non-empty reference in the request schema', () => {
    expect(memberPaymentRequestSchema.safeParse({
      type: 'SUBSCRIPTION', method: 'MPESA', reference: 'ABC123', confirmPaid: 'on',
    }).success).toBe(true)
    expect(memberPaymentRequestSchema.safeParse({
      type: 'SUBSCRIPTION', method: 'MPESA', reference: '', confirmPaid: 'on',
    }).success).toBe(false)
    expect(memberPaymentRequestSchema.safeParse({
      type: 'SUBSCRIPTION', method: 'MPESA', reference: 'ABC123', confirmPaid: '',
    }).success).toBe(false)
  })

  it('accepts a one-time retreat fee without a billing period and requires subscription periods', () => {
    expect(feeSettingInputSchema.safeParse({
      type: 'RETREAT_BONDING', amount: 1000, billingPeriod: '', reason: 'Committee approved retreat fee.',
    }).success).toBe(true)
    expect(feeSettingInputSchema.safeParse({
      type: 'SUBSCRIPTION', amount: 1000, billingPeriod: '', reason: 'Committee approved subscription fee.',
    }).success).toBe(false)
  })

  it('validates event payment names, descriptions, amounts, and optional deadlines', () => {
    expect(paymentEventCreateSchema.safeParse({
      title: 'Drama Festival Trip',
      description: 'Transport and entry fees for the festival.',
      amount: 1800,
      paymentDeadline: '',
    }).success).toBe(true)
    expect(paymentEventCreateSchema.safeParse({
      title: 'Trip',
      description: 'Festival',
      amount: 0,
      paymentDeadline: '',
    }).success).toBe(false)
  })

  it('reviews member claims once and does not treat the browser claim itself as success', async () => {
    await expect(reviewMemberPayment({
      paymentId, decision: 'FAILED', reason: 'Reference could not be matched.',
    }, actorId)).resolves.toEqual({ paymentId, status: 'FAILED' })
    expect(mocks.lockRow).toHaveBeenCalledWith(tx, 'Payment', paymentId)
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({
      status: 'FAILED', paidAt: null, resultDesc: 'Reference could not be matched.',
    }))
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'MEMBER_PAYMENT_REJECTED',
    }))
  })

  it('records an approved retreat payment without activating membership', async () => {
    await reviewMemberPayment({ paymentId, decision: 'SUCCESS', reason: 'Cash receipt confirmed.' }, actorId)
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({
      status: 'SUCCESS', paidAt: expect.any(Date),
    }))
    expect(mocks.activateMember).not.toHaveBeenCalled()
    expect(mocks.upsertMembershipPayment).not.toHaveBeenCalled()
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'MEMBER_PAYMENT_VERIFIED',
    }))
  })

  it('activates a pending member only after registration payment verification', async () => {
    mocks.paymentForReview.mockResolvedValue({
      id: paymentId, memberId, type: 'REGISTRATION', amount: 500, method: 'MPESA',
      reference: 'REG123', status: 'PENDING', source: 'MEMBER_REPORTED',
    })
    mocks.memberForPayment.mockResolvedValue({ id: memberId, status: 'PENDING_REGISTRATION' })

    await reviewMemberPayment({ paymentId, decision: 'SUCCESS', reason: 'Matched M-Pesa receipt.' }, actorId)

    expect(mocks.activateMember).toHaveBeenCalledWith(tx, memberId, expect.any(Date))
    expect(mocks.syncCurrentSeasonMemberStatus).toHaveBeenCalledWith(tx, memberId, 'ACTIVE')
    expect(mocks.recordStatusChange).toHaveBeenCalledWith(tx, memberId, 'PENDING_REGISTRATION', 'ACTIVE', expect.any(Date))
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({ status: 'SUCCESS' }))
  })

  it('records cancelled claims as cancelled rather than successful', async () => {
    await reviewMemberPayment({ paymentId, decision: 'CANCELLED', reason: 'Duplicate claim cancelled.' }, actorId)
    expect(mocks.updatePaymentReview).toHaveBeenCalledWith(tx, paymentId, expect.objectContaining({
      status: 'CANCELLED', paidAt: null,
    }))
  })

  it('rejects review of admin-created records or claims already reviewed', async () => {
    mocks.paymentForReview.mockResolvedValue({ source: 'ADMIN_MANUAL', status: 'PENDING' })
    await expect(reviewMemberPayment({
      paymentId, decision: 'SUCCESS', reason: 'Checked',
    }, actorId)).rejects.toThrow(/not found/)
    mocks.paymentForReview.mockResolvedValue({ source: 'MEMBER_REPORTED', status: 'SUCCESS' })
    await expect(reviewMemberPayment({
      paymentId, decision: 'SUCCESS', reason: 'Checked',
    }, actorId)).rejects.toThrow(/already been reviewed/)
    expect(mocks.updatePaymentReview).not.toHaveBeenCalled()
  })

  it.each(['RETREAT_BONDING', 'EVENT'] as const)('supports %s dashboard filters', (type) => {
    const parsed = paymentListSchema.safeParse({ type, status: 'PENDING' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(paymentWhere(parsed.data)).toEqual({ type, status: 'PENDING' })
  })
})
