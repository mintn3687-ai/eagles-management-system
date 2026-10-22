'use client'
import { useActionState } from 'react'
import { createRehearsalAction } from '@/app/admin/rehearsals/actions'
import { SubmitButton } from '@/components/submit-button'

export function CreateRehearsalForm() {
  const [state, action] = useActionState(createRehearsalAction, {})
  return <form action={action} className="grid gap-5 sm:grid-cols-2">
    <div className="sm:col-span-2"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" maxLength={100} required /></div>
    <div><label className="label" htmlFor="date">Date (YYYY-MM-DD)</label><input className="input" id="date" name="date" type="date" required /></div>
    <div><label className="label" htmlFor="startTime">Start time</label><input className="input" id="startTime" name="startTime" type="time" required /></div>
    <div><label className="label" htmlFor="endTime">End time</label><input className="input" id="endTime" name="endTime" type="time" required /></div>
    <div className="sm:col-span-2"><label className="label" htmlFor="venue">Venue</label><input className="input" id="venue" name="venue" maxLength={200} required /></div>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.success && <p role="status">Rehearsal created.</p>}
    <div className="sm:col-span-2"><SubmitButton>Create rehearsal</SubmitButton></div>
  </form>
}
