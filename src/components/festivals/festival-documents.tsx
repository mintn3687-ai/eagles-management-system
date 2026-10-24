'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_FESTIVAL_DOCUMENT_BYTES } from '@/modules/festivals/document-constants'

type FestivalDocument = {
  id: string
  originalName: string
  contentType: string
  sizeBytes: number
  status: 'PENDING_UPLOAD' | 'READY'
  createdAt: string
  uploadedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function apiPayload(response: Response) {
  const payload: unknown = await response.json()
  if (!isRecord(payload)) throw new Error('The server returned an invalid document response.')
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'The document request failed.')
  }
  return payload
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(value))
}

export function FestivalDocuments({ festivalId, documents }: {
  festivalId: string
  documents: FestivalDocument[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function beginUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    if (file.size < 1 || file.size > MAX_FESTIVAL_DOCUMENT_BYTES) {
      setError('Files must be between 1 byte and 20 MB.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/festivals/${encodeURIComponent(festivalId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ festivalId, fileName: file.name, sizeBytes: file.size }),
        cache: 'no-store',
      })
      const payload = await apiPayload(response)
      if (
        typeof payload.documentId !== 'string'
        || typeof payload.uploadUrl !== 'string'
        || typeof payload.contentType !== 'string'
      ) {
        throw new Error('The server returned invalid upload details.')
      }
      const abortController = new AbortController()
      const timeout = setTimeout(() => abortController.abort(), 120_000)
      let uploadResponse: Response
      try {
        uploadResponse = await fetch(payload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': payload.contentType },
          body: file,
          signal: abortController.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (!uploadResponse.ok) {
        throw new Error('Cloudflare R2 rejected the upload. Check the bucket CORS policy and try again.')
      }
      const completeResponse = await fetch(
        `/api/admin/festivals/${encodeURIComponent(festivalId)}/documents/${encodeURIComponent(payload.documentId)}`,
        { method: 'POST', cache: 'no-store' },
      )
      await apiPayload(completeResponse)
      if (fileRef.current) fileRef.current.value = ''
      setError('')
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'The upload took too long. Check the pending document below and retry or remove it.'
          : cause instanceof Error ? cause.message : 'Could not complete the upload.',
      )
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  async function downloadDocument(documentId: string) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/admin/festivals/${encodeURIComponent(festivalId)}/documents/${encodeURIComponent(documentId)}`,
        { cache: 'no-store' },
      )
      const payload = await apiPayload(response)
      if (typeof payload.url !== 'string') throw new Error('The server returned an invalid download link.')
      const link = document.createElement('a')
      link.href = payload.url
      link.rel = 'noopener'
      document.body.append(link)
      link.click()
      link.remove()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download the document.')
    } finally {
      setBusy(false)
    }
  }

  async function removeDocument(documentId: string) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/admin/festivals/${encodeURIComponent(festivalId)}/documents/${encodeURIComponent(documentId)}`,
        { method: 'DELETE', cache: 'no-store' },
      )
      await apiPayload(response)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the document.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-4">
    <header>
      <h2>Festival documents</h2>
      <p className="text-slate-600">Upload private festival documents. Only authorized festival managers can request a short-lived download link.</p>
    </header>
    <div className="card space-y-3">
      <h3>Upload a document</h3>
      <p className="text-sm text-slate-600">PDF, DOCX, XLSX, PNG, or JPEG · 20 MB maximum.</p>
      <div>
        <label className="label" htmlFor={`festival-document-${festivalId}`}>Choose file</label>
        <input
          ref={fileRef}
          className="input"
          id={`festival-document-${festivalId}`}
          name="file"
          type="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          disabled={busy}
          required
        />
      </div>
      <button type="button" className="button" onClick={beginUpload} disabled={busy}>
        {busy ? 'Working…' : 'Upload document'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <div className="card space-y-3">
      <h3>Document register</h3>
      {documents.length ? <ul className="divide-y divide-slate-100">
        {documents.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item.id}>
          <div className="min-w-0">
            <p className="break-words font-medium">{item.originalName}</p>
            <p className="text-sm text-slate-600">
              {formatFileSize(item.sizeBytes)} · {item.status === 'READY' ? 'Uploaded' : 'Upload pending'}
              {' · '}{formatUploadedAt(item.uploadedAt ?? item.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            {item.status === 'READY' && <button
              type="button"
              className="button-secondary"
              onClick={() => void downloadDocument(item.id)}
              disabled={busy}
            >Download</button>}
            <button
              type="button"
              className="button-secondary"
              onClick={() => void removeDocument(item.id)}
              disabled={busy}
            >Remove</button>
          </div>
        </li>)}
      </ul> : <p className="text-slate-600">No festival documents have been uploaded.</p>}
    </div>
  </section>
}
