import { NextResponse } from 'next/server'
import { getPayHeroCallbackReference } from '@/modules/finance/payhero-client'
import { FinanceServiceError, processPayHeroCallback } from '@/modules/finance/service'

export const runtime = 'nodejs'
const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 16_384) {
    return NextResponse.json({ error: 'Callback payload is too large.' }, { status: 413, headers: noStore })
  }

  let payload: unknown
  try {
    const text = await request.text()
    if (text.length > 16_384) return NextResponse.json({ error: 'Callback payload is too large.' }, { status: 413, headers: noStore })
    payload = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid callback payload.' }, { status: 400, headers: noStore })
  }

  const reference = getPayHeroCallbackReference(payload)
  if (!reference) return NextResponse.json({ error: 'Missing PayHero transaction reference.' }, { status: 400, headers: noStore })

  try {
    const result = await processPayHeroCallback(reference)
    return NextResponse.json(
      { received: true, status: result.status },
      { status: result.status === 'PENDING' ? 202 : 200, headers: noStore },
    )
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: 409, headers: noStore })
    }
    console.error('Could not verify PayHero callback.', error)
    return NextResponse.json({ error: 'Could not verify PayHero payment status.' }, { status: 503, headers: noStore })
  }
}
