import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccessError, requireRole } from '@/lib/permissions'
import { memberListSchema } from '@/lib/validation/members'
import { memberWhere, memberOrder } from '@/lib/members/query'
import { CSV_COLUMNS, csvLine } from '@/lib/members/csv'
import { nairobiDateKey } from '@/lib/dates'

export async function GET(request: Request) {
  try {
    await requireRole('COMMITTEE')
    const parsed = memberListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid list filters.' }, { status: 400 })
    const filters = parsed.data
    const encoder = new TextEncoder()
    let cursor: string | undefined
    let started = false
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (!started) { controller.enqueue(encoder.encode('\uFEFF' + csvLine([...CSV_COLUMNS]))); started = true }
          const members = await prisma.member.findMany({ where: memberWhere(filters), orderBy: memberOrder(filters),
            select: { id: true, fullName: true, phone: true, email: true, studentRegNo: true },
            take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          })
          if (members.length) {
            controller.enqueue(encoder.encode(members.map((m) => csvLine([m.fullName, m.phone, m.email, m.studentRegNo ?? ''])).join('')))
            cursor = members.at(-1)!.id
          }
          if (members.length < 200) controller.close()
        } catch (error) { controller.error(error) }
      },
    })
    return new Response(stream, { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="eagles-members-${nairobiDateKey()}.csv"`,
    } })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Could not export members.' }, { status: 500 })
  }
}
