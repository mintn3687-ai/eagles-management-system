export type MpesaInitiationResult = {
  ok: boolean
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  message: string
  checkoutRequestId?: string
}

export async function initiateStkPush(input: {
  memberId: string
  amount: number
  phone: string
  reference: string
  type: 'REGISTRATION' | 'SUBSCRIPTION'
}): Promise<MpesaInitiationResult> {
  const { amount, memberId, phone, reference, type } = input

  if (process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      status: 'FAILED',
      message: 'M-Pesa is not enabled in this phase. Use the committee payment log instead.',
    }
  }

  return {
    ok: true,
    status: 'SUCCESS',
    checkoutRequestId: `DEV-${type.toLowerCase()}-${memberId.slice(0, 8)}-${Date.now()}`,
    message: `Fake M-Pesa success for ${reference} (${phone}) for KES ${amount}.`,
  }
}
