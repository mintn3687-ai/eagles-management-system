'use client'

import { useActionState, type ReactNode } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { nairobiDateKey } from '@/lib/dates'
import {
  createFestivalAction,
  updateFestivalAction,
} from '@/modules/festivals/actions'
import type { FestivalActionState } from '@/modules/festivals/actions'

type FestivalFormAction = (state: FestivalActionState, form: FormData) => Promise<FestivalActionState>
type FestivalRecord = {
  id: string
  name: string
  year: number
  organizer: string | null
  venue: string | null
  startDate: Date | null
  endDate: Date | null
  status: string
  notes: string | null
}

function Form({ action: serverAction, submit, children }: {
  action: FestivalFormAction
  submit: string
  children: ReactNode
}) {
  const [state, action] = useActionState(serverAction, {})
  return <form action={action} className="card space-y-4">
    {children}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-800" role="status">{state.message}</p>}
    <SubmitButton>{submit}</SubmitButton>
  </form>
}

function FestivalFields({ festival, today }: { festival?: FestivalRecord; today: string }) {
  const prefix = festival ? `festival-${festival.id}` : 'new-festival'
  return <>
    <div><label className="label" htmlFor={`${prefix}-name`}>Festival name</label>
      <input className="input" id={`${prefix}-name`} name="name" maxLength={160} required defaultValue={festival?.name ?? ''} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-year`}>Year</label>
        <input className="input" id={`${prefix}-year`} name="year" type="number" min="1900" max="2200" step="1" required defaultValue={festival?.year ?? Number(today.slice(0, 4))} />
      </div>
      <div><label className="label" htmlFor={`${prefix}-organizer`}>University / organizer</label>
        <input className="input" id={`${prefix}-organizer`} name="organizer" maxLength={160} defaultValue={festival?.organizer ?? ''} />
      </div>
    </div>
    <div><label className="label" htmlFor={`${prefix}-venue`}>Venue</label>
      <input className="input" id={`${prefix}-venue`} name="venue" maxLength={160} defaultValue={festival?.venue ?? ''} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-start`}>Start date</label>
        <input className="input" id={`${prefix}-start`} name="startDate" type="date" defaultValue={festival?.startDate ? nairobiDateKey(festival.startDate) : today} />
      </div>
      <div><label className="label" htmlFor={`${prefix}-end`}>End date</label>
        <input className="input" id={`${prefix}-end`} name="endDate" type="date" defaultValue={festival?.endDate ? nairobiDateKey(festival.endDate) : ''} />
      </div>
    </div>
    {festival && <div><label className="label" htmlFor={`${prefix}-status`}>Status</label>
      <select className="input" id={`${prefix}-status`} name="status" defaultValue={festival.status}>
        <option value="DRAFT">Draft</option>
        <option value="PLANNING">Planning</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
    </div>}
    <div><label className="label" htmlFor={`${prefix}-notes`}>Notes</label>
      <textarea className="input" id={`${prefix}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={festival?.notes ?? ''} />
    </div>
  </>
}

export function FestivalCreateForm({ today }: { today: string }) {
  return <Form action={createFestivalAction} submit="Create festival">
    <h2>Plan a festival</h2>
    <FestivalFields today={today} />
  </Form>
}

export function FestivalUpdateForm({ festival, today }: { festival: FestivalRecord; today: string }) {
  return <Form action={updateFestivalAction} submit="Save festival details">
    <input type="hidden" name="festivalId" value={festival.id} />
    <h2>Festival details</h2>
    <FestivalFields festival={festival} today={today} />
  </Form>
}
