'use client'
import { useActionState } from 'react'
import { previewWeeklyAction, generateWeeklyAction } from '@/app/admin/rehearsals/actions'

export function WeeklyGeneratorForm() {
  const [previewState, previewAction] = useActionState(previewWeeklyAction, {})
  const [genState, genAction] = useActionState(generateWeeklyAction, {})
  const preview = previewState.preview
  return <div className="space-y-6">
    <section className="card">
      <h2>Schedule</h2>
      <form action={previewAction} className="grid gap-5 sm:grid-cols-2">
        <div><label className="label" htmlFor="weekday">Weekday</label><select className="input" id="weekday" name="weekday" defaultValue="" required><option value="" disabled>Select a weekday</option>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div></div>
        <div><label className="label" htmlFor="startTime">Start time</label><input className="input" id="startTime" name="startTime" type="time" required /></div>
        <div><label className="label" htmlFor="endTime">End time</label><input className="input" id="endTime" name="endTime" type="time" required /></div>
        <div><label className="label" htmlFor="startDate">Start date</label><input className="input" id="startDate" name="startDate" type="date" required /></div>
        <div><label className="label" htmlFor="endDate">End date</label><input className="input" id="endDate" name="endDate" type="date" required /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="venue">Venue (applied to all dates)</label><input className="input" id="venue" name="venue" maxLength={200} required /></div>
        <div className="sm:col-span-2"><button type="submit" className="btn-secondary">Preview</button></div>
        {previewState.error && <p className="error" role="alert">{previewState.error}</p>}
      </form>
    </section>
    {preview && (
      <section className="card">
        <h2>Preview: {preview.weekday} at {preview.time}</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {preview.dates.map((d) => <li key={d}>{d}</li>)}
        </ul>
        {preview.dates.length === 0 && <p className="text-slate-500">No rehearsals would be created.</p>}
        <form action={genAction} className="mt-4 space-y-4">
          <input type="hidden" name="weekday" value={previewState.weekday ?? preview.weekday} />
          <input type="hidden" name="startTime" value={previewState.startTime ?? ''} />
          <input type="hidden" name="endTime" value={previewState.endTime ?? ''} />
          <input type="hidden" name="startDate" value={previewState.startDate ?? ''} />
          <input type="hidden" name="endDate" value={previewState.endDate ?? ''} />
          <input type="hidden" name="venue" value={previewState.venue ?? ''} />
          <button type="submit" className="btn-primary">Confirm and create</button>
          {genState.error && <p className="error" role="alert">{genState.error}</p>}
          {genState.created && <p role="status" className="text-emerald-800">Created {genState.created.length} rehearsals.</p>}
        </form>
      </section>
    )}
  </div>
}
