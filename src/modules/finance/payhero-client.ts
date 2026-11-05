import 'server-only'
import { z } from 'zod'
import { normalizeKenyanPhone } from '@/lib/validation/phone'

const PAYHERO_BASE_URL = 'https://backend.payhero.co.ke/api/v2'
const optionalSecret = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
)

const configSchema = z.object({
  username: optionalSecret,
  password: optionalSecret,
  basicAuthToken: optionalSecret,
  channelId: z.coerce.number().int().positive(),
  callbackUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:'),
}).superRefine((config, ctx) => {
  if (!config.basicAuthToken && (!config.username || !config.password)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Set PayHero Basic Auth or API username and password.' })
  }
})

export class PayHeroError extends Error {
  constructor(message: string, public readonly rejected = false) {
    super(message)
  }
}

export type PayHeroTransactionStatus = {
  reference: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  amount: number | null
  receipt: string | null
  description: string
}

function environmentConfig() {
  return {
    username: process.env.PAYHERO_API_USERNAME,
    password: process.env.PAYHERO_API_PASSWORD,
    basicAuthToken: process.env.PAYHERO_BASIC_AUTH_TOKEN,
    channelId: process.env.PAYHERO_CHANNEL_ID,
    callbackUrl: process.env.PAYHERO_CALLBACK_URL,
  }
}

function config() {
  const parsed = configSchema.safeParse(environmentConfig())
  if (!parsed.success) throw new PayHeroError('PayHero is not fully configured. Check server environment settings.')
  return parsed.data
}

export function isPayHeroConfigured() {
  return process.env.PAYHERO_ENABLED === 'true'
    && configSchema.safeParse(environmentConfig()).success
}

function authorizationHeader(values: ReturnType<typeof config>) {
  if (values.basicAuthToken) {
    return /^Basic\s/i.test(values.basicAuthToken)
      ? values.basicAuthToken
      : `Basic ${values.basicAuthToken}`
  }
  return `Basic ${Buffer.from(`${values.username}:${values.password}`).toString('base64')}`
}

async function request(path: string, init: RequestInit) {
  const values = config()
  let response: Response
  try {
    response = await fetch(`${PAYHERO_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: authorizationHeader(values),
        'Content-Type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new PayHeroError('PayHero could not be reached. The payment may still be processing; check payment history before retrying.')
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new PayHeroError('PayHero returned an unreadable response.')
    }
  }
  if (!response.ok) {
    throw new PayHeroError(`PayHero rejected the request (HTTP ${response.status}).`, response.status >= 400 && response.status < 500)
  }
  return { body, values }
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstValue(objects: Record<string, unknown>[], keys: string[]) {
  for (const candidate of [...objects].reverse()) {
    for (const key of keys) {
      if (candidate[key] !== undefined && candidate[key] !== null) return candidate[key]
    }
  }
  return undefined
}

function responseObjects(body: unknown) {
  const result: Record<string, unknown>[] = []
  let current = object(body)
  for (let depth = 0; current && depth < 4; depth += 1) {
    result.push(current)
    current = object(current.data) ?? object(current.response) ?? object(current.result)
  }
  return result
}

function providerStatus(value: unknown): PayHeroTransactionStatus['status'] {
  const status = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'COMPLETE', 'PAID'].includes(status)) return 'SUCCESS'
  if (['FAILED', 'FAILURE', 'ERROR', 'REJECTED'].includes(status)) return 'FAILED'
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'CANCELLED'
  return 'PENDING'
}

export async function initiatePayHeroCheckout(input: {
  amount: number
  phone: string
  reference: string
  customerName: string
}) {
  const values = config()
  const phone = normalizeKenyanPhone(input.phone)
  if (!phone) throw new PayHeroError('Enter a valid Kenyan mobile number.')

  const { body } = await request('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      phone_number: `0${phone.slice(3)}`,
      channel_id: values.channelId,
      provider: 'm-pesa',
      external_reference: input.reference,
      callback_url: values.callbackUrl,
      customer_name: input.customerName,
    }),
  })
  const candidates = responseObjects(body)
  const success = firstValue(candidates, ['success', 'Success'])
  if (success === false) throw new PayHeroError('PayHero did not accept the checkout request.', true)
  const checkoutRequestId = firstValue(candidates, ['CheckoutRequestID', 'checkout_request_id', 'checkoutRequestId'])
  return typeof checkoutRequestId === 'string' && checkoutRequestId.length > 0
    ? checkoutRequestId
    : null
}

export async function getPayHeroTransactionStatus(reference: string): Promise<PayHeroTransactionStatus> {
  const { body } = await request(`/transaction-status?reference=${encodeURIComponent(reference)}`, { method: 'GET' })
  const candidates = responseObjects(body)
  const responseReference = firstValue(candidates, ['ExternalReference', 'external_reference', 'externalReference', 'reference'])
  const amountValue = firstValue(candidates, ['Amount', 'amount'])
  const amount = typeof amountValue === 'number'
    ? amountValue
    : typeof amountValue === 'string' && /^\d+$/.test(amountValue) ? Number(amountValue) : null
  const receiptValue = firstValue(candidates, ['MpesaReceiptNumber', 'mpesa_receipt_number', 'receipt', 'receipt_number'])
  const statusValue = firstValue(candidates, ['Status', 'status'])
  const descriptionValue = firstValue(candidates, ['ResultDesc', 'result_description', 'message', 'description'])
  const resultCode = firstValue(candidates, ['ResultCode', 'result_code'])
  const status = resultCode === 0 || resultCode === '0'
    ? 'SUCCESS'
    : resultCode !== undefined && resultCode !== null
      ? String(resultCode) === '1032' ? 'CANCELLED' : 'FAILED'
      : providerStatus(statusValue)
  return {
    reference: typeof responseReference === 'string' ? responseReference : reference,
    status,
    amount,
    receipt: typeof receiptValue === 'string' && receiptValue.trim() ? receiptValue.trim() : null,
    description: typeof descriptionValue === 'string' ? descriptionValue.slice(0, 500) : 'PayHero transaction status update.',
  }
}

export function getPayHeroCallbackReference(body: unknown) {
  const candidates = responseObjects(body)
  const value = firstValue(candidates, ['ExternalReference', 'external_reference', 'externalReference', 'reference'])
  return typeof value === 'string' && value.length <= 120 ? value : null
}
