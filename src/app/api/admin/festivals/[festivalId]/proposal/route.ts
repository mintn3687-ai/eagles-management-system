import { NextResponse } from 'next/server'
import { AccessError, requirePermission } from '@/lib/permissions'
import { getFestival, getFestivalPlanning } from '@/modules/festivals/service'
import { createFestivalProposalPdf } from '@/modules/festivals/proposal-pdf'

type RouteContext = { params: Promise<{ festivalId: string }> }
const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission('festivals:manage')
    await requirePermission('finance:manage')
    const { festivalId } = await context.params
    const festival = await getFestival(festivalId)
    if (!festival) {
      return NextResponse.json({ error: 'Festival not found.' }, { status: 404, headers: noStore })
    }
    const planning = await getFestivalPlanning(festivalId, true)
    const pdf = await createFestivalProposalPdf({ festival, planning })
    const fileName = `${festival.name}-${festival.year}-festival-proposal`
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'festival-proposal'

    return new Response(Buffer.from(pdf), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore })
    }
    console.error('Could not generate festival proposal PDF.', error)
    return NextResponse.json(
      { error: 'The festival proposal PDF could not be generated.' },
      { status: 500, headers: noStore },
    )
  }
}
