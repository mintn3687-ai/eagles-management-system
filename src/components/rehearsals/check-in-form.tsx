'use client'
import { useActionState, useEffect, useState } from 'react'
import { markPresentAction } from '@/app/member/attendance/actions'
import { SubmitButton } from '@/components/submit-button'

export function CheckInForm({ rehearsalId }: { rehearsalId: string }) {
  const [state, action] = useActionState(markPresentAction, {})
  const [code, setCode] = useState('')

  useEffect(() => {
    const codeFromQr = new URLSearchParams(window.location.hash.slice(1)).get('code')
    if (!codeFromQr || !/^\d{4}$/.test(codeFromQr)) return
    setCode(codeFromQr)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  return <form action={action} className="space-y-4">
    <input type="hidden" name="rehearsalId" value={rehearsalId} />
    <div>
      <label className="label" htmlFor="code">Check-in code</label>
      <input className="input text-center font-mono text-3xl tracking-widest" id="code" name="code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={4} pattern="\d{4}" required autoComplete="one-time-code" />
    </div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p role="status" className="text-emerald-800">You are marked present.</p>}
    <SubmitButton>Mark present</SubmitButton>
  </form>
}
