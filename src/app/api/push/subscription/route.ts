import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { AccessError, requireRole } from '@/lib/permissions'
import {
  disablePushSubscription,
  enablePushSubscription,
  isPushSubscriptionEnabled,
} from '@/modules/push/service'

const tokenSchema = z.object({ token: z.string().trim().min(1).max(8192) })
const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET(request: Request) {
  try {
    const user = await requireRole('MEMBER')
    const token = tokenSchema.shape.token.parse(request.headers.get('x-push-token'))
    const enabled = await isPushSubscriptionEnabled(user.id, token)
    return NextResponse.json({ enabled }, { headers: noStore })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid notification subscription.' }, { status: 400, headers: noStore })
    }
    console.error('Could not read push subscription state.', error)
    return NextResponse.json({ error: 'Could not check notification settings.' }, { status: 500, headers: noStore })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole('MEMBER')
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, { status: 403, headers: noStore })
    }
    const { token } = tokenSchema.parse(await request.json())
    await enablePushSubscription(user.id, token)
    return NextResponse.json({ enabled: true }, { headers: noStore })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid notification subscription.' }, { status: 400, headers: noStore })
    }
    console.error('Could not save push subscription.', error)
    return NextResponse.json({ error: 'Could not enable notifications.' }, { status: 500, headers: noStore })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireRole('MEMBER')
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, { status: 403, headers: noStore })
    }
    const { token } = tokenSchema.parse(await request.json())
    await disablePushSubscription(user.id, token)
    return NextResponse.json({ enabled: false }, { headers: noStore })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid notification subscription.' }, { status: 400, headers: noStore })
    }
    console.error('Could not remove push subscription.', error)
    return NextResponse.json({ error: 'Could not disable notifications.' }, { status: 500, headers: noStore })
  }
}
