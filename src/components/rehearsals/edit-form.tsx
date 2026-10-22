'use client'
import { useActionState } from 'react'
import { editRehearsalAction } from '@/app/admin/rehearsals/actions'
import { SubmitButton } from '@/components/submit-button'
import { nairobiDateKey } from '@/lib/dates'
import type { RehearsalStatus } from '@prisma/client'

type Rehearsal = {
  id: string; title: string; date: Date; startTime: string; endTime: string
  venue: string; status: RehearsalStatus; checkInCode: string | null
}

export function EditRehearsalForm({ rehearsal }: { rehearsal: Rehearsal }) {
  const [state, action] = useActionState(editRehearsalAction, {})
  return <section className="card">
    <h2>Edit rehearsal</h2>
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="rehearsalId" value={rehearsal.id} />
      <div className="sm:col-span-2"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" maxLength={100} defaultValue={rehearsal.title} /></div>
      <div><label className="label" htmlFor="date">Date</label><input className="input" id="date" name="date" type="date" defaultValue={nairobiDateKey(rehearsal.date)} /></div>
      <div><label className="label" htmlFor="startTime">Start time</label><input className="input" id="startTime" name="startTime" type="time" defaultValue={rehearsal.startTime} /></div>
      <div><label className="label" htmlFor="endTime">End time</label><input className="input" id="endTime" name="endTime" type="time" defaultValue={rehearsal.endTime} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="venue">Venue</label><input className="input" id="venue" name="venue" maxLength={200} defaultValue={rehearsal.venue} /></div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.success && <p role="status">Details updated.</p>}
      <div className="sm:col-span-2"><SubmitButton>Save rehearsal</SubmitButton></div>
    </form>
  </section>
}
