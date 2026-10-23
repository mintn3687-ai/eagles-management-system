'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createCheckInLink } from '@/lib/rehearsals/check-in-link'

export function CheckInQrCode({ rehearsalId, code }: { rehearsalId: string; code: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(createCheckInLink(window.location.origin, rehearsalId, code))
  }, [rehearsalId, code])

  if (!url) return null

  return <div className="space-y-3 text-center">
    <QRCodeSVG value={url} size={240} level="M" className="mx-auto rounded bg-white p-3" title="Scan to open rehearsal check-in" />
    <p className="text-sm text-slate-600">Members can scan this with their phone camera. It opens attendance with the code filled in; they still need to sign in and submit.</p>
  </div>
}
