import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { festivalDocumentIdSchema } from '@/modules/festivals/schema'
import {
  deleteFestivalDocument,
  completeFestivalDocumentUpload,
  getFestivalDocumentDownload,
} from '@/modules/festivals/service'
import {
  festivalDocumentErrorResponse,
  festivalDocumentNoStore,
  isSameOriginFestivalDocumentRequest,
} from '@/modules/festivals/document-api'

type RouteContext = { params: Promise<{ festivalId: string; documentId: string }> }

async function festivalDocumentActor() {
  const actor = await requirePermission('festivals:manage')
  await requirePermission('finance:manage')
  return actor
}

async function parseDocumentParams(context: RouteContext) {
  const params = await context.params
  return festivalDocumentIdSchema.parse(params)
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await festivalDocumentActor()
    const { festivalId, documentId } = await parseDocumentParams(context)
    const result = await getFestivalDocumentDownload(festivalId, documentId)
    return NextResponse.json(result, { headers: festivalDocumentNoStore })
  } catch (error) {
    return festivalDocumentErrorResponse(error, 'Could not create festival document download.')
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await festivalDocumentActor()
    if (!isSameOriginFestivalDocumentRequest(request)) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, {
        status: 403,
        headers: festivalDocumentNoStore,
      })
    }
    const { festivalId, documentId } = await parseDocumentParams(context)
    const document = await completeFestivalDocumentUpload(festivalId, documentId, actor.id)
    return NextResponse.json({ documentId: document.id, status: document.status }, {
      headers: festivalDocumentNoStore,
    })
  } catch (error) {
    return festivalDocumentErrorResponse(error, 'Could not verify festival document upload.')
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await festivalDocumentActor()
    if (!isSameOriginFestivalDocumentRequest(request)) {
      return NextResponse.json({ error: 'Please submit this request from the club website.' }, {
        status: 403,
        headers: festivalDocumentNoStore,
      })
    }
    const { festivalId, documentId } = await parseDocumentParams(context)
    await deleteFestivalDocument(festivalId, documentId, actor.id)
    return NextResponse.json({ deleted: true }, { headers: festivalDocumentNoStore })
  } catch (error) {
    return festivalDocumentErrorResponse(error, 'Could not delete festival document.')
  }
}
