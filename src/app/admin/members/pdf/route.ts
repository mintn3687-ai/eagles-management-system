import { NextResponse } from 'next/server'
import { AccessError, requireRole } from '@/lib/permissions'
import { nairobiDateKey } from '@/lib/dates'
import { createCompleteMemberRosterPdf } from '@/modules/members/roster-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireRole('COMMITTEE')
    const pdf = await createCompleteMemberRosterPdf()
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="eagles-member-roster-${nairobiDateKey()}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Could not export the member roster.', error)
    return NextResponse.json({ error: 'Could not export the member roster.' }, { status: 500 })
  }
}
