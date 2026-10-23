'use client'
import { useActionState } from 'react'
import { openSessionAction, closeSessionAction } from '@/app/admin/rehearsals/actions'
import { CheckInQrCode } from './check-in-qr-code'

export function SessionControls({ rehearsalId, state = 'scheduled', checkInCode }: { rehearsalId: string; state?: 'scheduled' | 'open'; checkInCode?: string | null }) {
  const [openState, openAction] = useActionState(openSessionAction, {})
  const [closeState, closeAction] = useActionState(closeSessionAction, {})
  return <section className="card space-y-4">
    <h2>{state === 'open' ? 'Session open' : 'Session controls'}</h2>
    {state === 'open' && (<>
      <p className="text-slate-600">The check-in code <span className="block text-center font-mono text-8xl sm:text-9xl tracking-widest font-bold">{checkInCode}</span> is shown for projection. Members can enter the code or scan the QR code.</p>
      {checkInCode && <CheckInQrCode rehearsalId={rehearsalId} code={checkInCode} />}
    </>)}
    {state === 'scheduled' && (<form action={openAction}><input type="hidden" name="rehearsalId" value={rehearsalId} /><button type="submit" className="btn-primary">Open session</button>{openState.error && <p className="error" role="alert">{openState.error}</p>}{openState.checkInCode && <p role="status" className="text-emerald-800">Session opened. Code: {openState.checkInCode}</p>}</form>)}
    {state === 'open' && (<form action={closeAction}><input type="hidden" name="rehearsalId" value={rehearsalId} /><button type="submit" className="btn-secondary" disabled={closeState.success}>Close session</button>{closeState.error && <p className="error" role="alert">{closeState.error}</p>}{closeState.createdRows !== undefined && <p role="status" className="text-emerald-800">Session closed. {closeState.createdRows} members marked as no-response.</p>}</form>)}
  </section>
}
