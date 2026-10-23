import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { AccessError, requireRole } from '@/lib/permissions'
import { sendPushNotice } from '@/modules/push/service'

const announcementSchema = z.object({
  requestId: z.string().uuid(),
  category: z.enum(['REHEARSALS', 'MEETINGS', 'PRODUCTIONS_AND_SHOWS', 'ELECTIONS', 'GENERAL_ANNOUNCEMENTS']),
}).strict()
const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: Request) {
  try {
    await requireRole('COMMITTEE')
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, { status: 403, headers: noStore })
    }
    const { requestId, category } = announcementSchema.parse(await request.json())
    const result = await sendPushNotice(`announcement:${requestId}:${category}`, {
      title: 'Eagles Drama Club',
      body: 'A new club update is available. Sign in to view the details.',
    })
    return NextResponse.json(result, { headers: noStore })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Choose a valid announcement category.' }, { status: 400, headers: noStore })
    }
    console.error('Could not send club announcement.', error)
    return NextResponse.json({ error: 'Could not send the announcement.' }, { status: 500, headers: noStore })
  }
}
