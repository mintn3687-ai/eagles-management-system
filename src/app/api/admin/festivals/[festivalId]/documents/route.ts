import { NextResponse } from 'next/server'
import { AccessError, requirePermission } from '@/lib/permissions'
import { festivalDocumentUploadSchema } from '@/modules/festivals/schema'
import { createFestivalDocumentUpload } from '@/modules/festivals/service'
import {
  festivalDocumentErrorResponse,
  festivalDocumentNoStore,
  isSameOriginFestivalDocumentRequest,
} from '@/modules/festivals/document-api'

type RouteContext = { params: Promise<{ festivalId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission('festivals:manage')
    await requirePermission('finance:manage')
    if (!isSameOriginFestivalDocumentRequest(request)) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, {
        status: 403,
        headers: festivalDocumentNoStore,
      })
    }
    const length = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(length) && length > 4096) {
      return NextResponse.json({ error: 'Document upload details are too large.' }, {
        status: 413,
        headers: festivalDocumentNoStore,
      })
    }
    const { festivalId } = await context.params
    const parsed = festivalDocumentUploadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return festivalDocumentErrorResponse(parsed.error, 'Invalid festival document upload details.')
    }
    if (parsed.data.festivalId !== festivalId) {
      return NextResponse.json({ error: 'The document festival does not match this request.' }, {
        status: 400,
        headers: festivalDocumentNoStore,
      })
    }
    const result = await createFestivalDocumentUpload(parsed.data, actor.id)
    return NextResponse.json(result, { headers: festivalDocumentNoStore })
  } catch (error) {
    if (error instanceof AccessError) {
      return festivalDocumentErrorResponse(error, 'Festival document access denied.')
    }
    return festivalDocumentErrorResponse(error, 'Could not start festival document upload.')
  }
}
