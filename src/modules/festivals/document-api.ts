import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AccessError } from '@/lib/permissions'
import { FestivalDocumentServiceError } from './service'

export const festivalDocumentNoStore = { 'Cache-Control': 'no-store, max-age=0' }

export function isSameOriginFestivalDocumentRequest(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}

export function festivalDocumentErrorResponse(error: unknown, operation: string) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: festivalDocumentNoStore,
    })
  }
  if (error instanceof FestivalDocumentServiceError) {
    return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: festivalDocumentNoStore,
    })
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? 'Check the document details.'
      : 'Submit valid JSON.'
    return NextResponse.json({ error: message }, {
      status: 400,
      headers: festivalDocumentNoStore,
    })
  }
  console.error(operation, error)
  return NextResponse.json({ error: 'The document request could not be completed.' }, {
    status: 500,
    headers: festivalDocumentNoStore,
  })
}
