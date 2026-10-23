'use client'
import { useActionState } from 'react'
import { reviewSingleAction, reviewBulkAction } from '@/app/admin/absences/actions'
import { SubmitButton } from '@/components/submit-button'
import type { AbsenceListItem } from '@/modules/absences/service'

export function AbsenceList({ records }: { records: AbsenceListItem[] }) {
  const [bulkState, bulkAction] = useActionState(reviewBulkAction, {})
  const [singleState, singleAction] = useActionState(reviewSingleAction, {})
  if (!records.length) {
    return <section className="card"><p className="text-slate-600">No pending absence reviews.</p></section>
  }
  return <section className="card">
    {(bulkState.error || singleState.error) && <p className="error" role="alert">{bulkState.error || singleState.error}</p>}
    <form id="bulk-review" action={bulkAction} className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => { document.querySelectorAll<HTMLInputElement>('[name="attendanceIds"]').forEach(cb => cb.checked = e.target.checked) }} /> Select all</label>
        <select className="input h-auto w-auto" name="action"><option value="EXCUSE">Excuse</option><option value="UNEXCUSE">Mark unexcused</option><option value="MARK_PRESENT">Mark present (NO_RESPONSE only)</option></select>
        <input className="input w-64" name="note" placeholder="Optional note" maxLength={1000} />
        <SubmitButton>Apply to selected</SubmitButton>
      </div>
    </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-stone-100"><tr>{['', 'Date', 'Member', 'Rehearsal', 'Status', 'Reason', 'Marked', 'Action'].map((h) => <th className="p-3" key={h}>{h || ' '}</th>)}</tr></thead>
          <tbody>
            {records.map((r) => (
              <tr className="border-t" key={r.id}>
                <td className="p-3"><input type="checkbox" form="bulk-review" aria-label={`Select ${r.member.fullName}`} name="attendanceIds" value={r.id} /></td>
                <td className="p-3">{formatNairobiDate(r.rehearsal.date)}</td>
                <td className="p-3">{r.member.fullName} <span className="text-slate-500">({r.member.phone})</span></td>
                <td className="p-3">{r.rehearsal.title} · {r.rehearsal.startTime}–{r.rehearsal.endTime}</td>
                <td className="p-3 font-medium">{r.status === 'ABSENT' ? 'Absent' : 'No response'}</td>
                <td className="p-3 max-w-xs whitespace-normal">{r.reason ?? '—'}</td>
                <td className="p-3">{new Date(r.markedAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="p-3">
                  <form action={singleAction} className="flex items-center gap-2">
                    <input type="hidden" name="attendanceId" value={r.id} />
                    <input className="input w-40" name="note" placeholder="Note (req. for present)" maxLength={1000} />
                    <button className="btn-primary" name="action" value="EXCUSE" type="submit">Excuse</button>
                    <button className="btn-secondary" name="action" value="UNEXCUSE" type="submit">Mark Unexcused</button>
                    {r.status === 'NO_RESPONSE' && <button className="btn-secondary" name="action" value="MARK_PRESENT" type="submit">Mark present</button>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  </section>
}

function formatNairobiDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', year: 'numeric', month: 'long', day: 'numeric' })
}
