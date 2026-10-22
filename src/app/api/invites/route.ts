import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createInvite, InviteError } from '@/lib/auth/create-invite'
import { AccessError, requireRole } from '@/lib/permissions'
import { inviteCreateSchema } from '@/lib/validation/auth'

export async function POST(request: Request) {
  try {
    await requireRole('COMMITTEE')
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, { status: 403 })
    }
    const { userId } = inviteCreateSchema.parse(await request.json())
    const result = await createInvite(userId)
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Enter a valid user ID.' }, { status: 400 })
    }
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Could not create the invitation. Please try again.' }, { status: 500 })
  }
}
