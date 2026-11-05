import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  getPayHeroCallbackReference,
  getPayHeroTransactionStatus,
  initiatePayHeroCheckout,
  isPayHeroConfigured,
} from '../src/modules/finance/payhero-client'

function configurePayHero() {
  vi.stubEnv('PAYHERO_ENABLED', 'true')
  vi.stubEnv('PAYHERO_API_USERNAME', 'test-user')
  vi.stubEnv('PAYHERO_API_PASSWORD', 'test-password')
  vi.stubEnv('PAYHERO_BASIC_AUTH_TOKEN', '')
  vi.stubEnv('PAYHERO_CHANNEL_ID', '14893')
  vi.stubEnv('PAYHERO_CALLBACK_URL', 'https://eagles-management-system.vercel.app/api/payments/payhero/callback')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('PayHero API client', () => {
  it('is disabled until explicitly enabled and all server configuration is present', () => {
    configurePayHero()
    expect(isPayHeroConfigured()).toBe(true)
    vi.stubEnv('PAYHERO_ENABLED', 'false')
    expect(isPayHeroConfigured()).toBe(false)
  })

  it('sends an authenticated server-priced checkout using a normalized Kenyan phone', async () => {
    configurePayHero()
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { CheckoutRequestID: 'ws_CO_123' } }),
      { status: 201 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(initiatePayHeroCheckout({
      amount: 1250,
      phone: '+254 (140) 246-624',
      reference: 'EDC-123',
      customerName: 'Test Member',
    })).resolves.toBe('ws_CO_123')

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://backend.payhero.co.ke/api/v2/payments')
    expect(new Headers(request.headers).get('authorization')).toBe(`Basic ${Buffer.from('test-user:test-password').toString('base64')}`)
    expect(JSON.parse(String(request.body))).toEqual({
      amount: 1250,
      phone_number: '0140246624',
      channel_id: 14893,
      provider: 'm-pesa',
      external_reference: 'EDC-123',
      callback_url: 'https://eagles-management-system.vercel.app/api/payments/payhero/callback',
      customer_name: 'Test Member',
    })
  })

  it('uses the configured Basic token and parses provider transaction details', async () => {
    configurePayHero()
    vi.stubEnv('PAYHERO_BASIC_AUTH_TOKEN', 'Basic dXNlcjpwYXNz')
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        status: 'success',
        data: {
          ExternalReference: 'EDC-123',
          Amount: 1250,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          MpesaReceiptNumber: 'QWERTY123',
        },
      }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPayHeroTransactionStatus('EDC-123')).resolves.toEqual({
      reference: 'EDC-123',
      status: 'SUCCESS',
      amount: 1250,
      receipt: 'QWERTY123',
      description: 'The service request is processed successfully.',
    })
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('authorization')).toBe('Basic dXNlcjpwYXNz')
  })

  it('extracts callback references but does not treat callback status as proof of payment', () => {
    expect(getPayHeroCallbackReference({
      status: 'SUCCESS',
      response: { ExternalReference: 'EDC-123', ResultCode: 0 },
    })).toBe('EDC-123')
    expect(getPayHeroCallbackReference({ status: 'SUCCESS' })).toBeNull()
  })
})
