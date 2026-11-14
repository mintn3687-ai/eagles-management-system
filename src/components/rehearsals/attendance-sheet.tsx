'use client'

import { useActionState } from 'react'
import { setManualAttendanceAction } from '@/app/admin/rehearsals/actions'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import { formatNairobiTime } from '@/lib/dates'
import type { MemberStatus, RehearsalStatus } from '@prisma/client'

type Rehearsal = {
  id: string; title: string; date: Date; startTime: string; endTime: string
  venue: string; status: RehearsalStatus; checkInCode: string | null
}

type Member = {
  id: string; fullName: string; phone: string; joinedAt: Date; status: MemberStatus
  rehearsals: { id: string; status: 'PRESENT' | 'ABSENT' | 'NO_RESPONSE'; markedBy: 'SELF' | 'COMMITTEE' | 'SYSTEM'; checkedInAt: Date | null; reason: string | null; reviewStatus: 'NONE' | 'PENDING' | 'EXCUSED' | 'UNEXCUSED' }[]
}

export function AttendanceSheet({ rehearsal, members, totalMembers, page, pageCount, locked = false }: { rehearsal: Rehearsal; members: Member[]; totalMembers: number; page: number; pageCount: number; locked?: boolean }) {
  const [state, action] = useActionState(setManualAttendanceAction, {})
  return <section className="card">
    <h2>Attendance sheet</h2>
    {locked && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Attendance is locked. No one can be marked present after the scheduled rehearsal end time.</p>}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.success && <p role="status">Attendance saved.</p>}
    <p className="text-sm text-slate-600">Attendance closes automatically at {rehearsal.endTime} Nairobi time.</p>
    <p className="mb-4 text-sm text-slate-500">{totalMembers} members · Page {page} of {pageCount}.</p>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-stone-100">
          <tr>{['Member', 'Phone', 'Attendance', 'Reason', 'Checked in', 'Marked by', 'Review', ''].map((h) => <th className="p-3" key={h}>{h || ' '}</th>)}</tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr className="border-t" key={m.id}>
              <td className="p-3">{m.fullName}{m.status !== 'ACTIVE' && <span className="block text-xs text-slate-500">Not currently active</span>}</td>
              <td className="p-3">{m.phone}</td>
              <td className="p-3">{m.rehearsals[0]?.status === 'NO_RESPONSE' ? 'Pending' : m.rehearsals[0]?.status.replaceAll('_', ' ') ?? 'Pending'}</td>
              <td className="p-3">{m.rehearsals[0]?.reason ?? '—'}</td>
              <td className="p-3">{m.rehearsals[0]?.checkedInAt ? formatNairobiTime(m.rehearsals[0].checkedInAt) : '—'}</td>
              <td className="p-3">{m.rehearsals[0]?.markedBy ?? '—'}</td>
              <td className="p-3">{m.rehearsals[0]?.reviewStatus.replace('_', ' ') ?? '—'}</td>
              <td className="p-3">
                {!locked && m.status === 'ACTIVE' && <form action={action} className="flex items-center gap-2">
                  <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <select className="input h-auto w-24 text-sm" name="status">
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                  <input name="note" className="input" aria-label="Attendance note (optional)" placeholder="Optional note" maxLength={1000} />
                  <SubmitButton>Save</SubmitButton>
                </form>}
              </td>
            </tr>
          ))}
          {!members.length && <tr><td className="p-6" colSpan={8}>No active members or recorded attendance for this rehearsal.</td></tr>}
        </tbody>
      </table>
    </div>
    <nav className="mt-4 flex flex-wrap gap-3" aria-label="Attendance sheet pages">
      {page > 1 && <Link className="btn-secondary" href={`/admin/rehearsals/${rehearsal.id}?page=${page - 1}`}>Previous members</Link>}
      {page < pageCount && <Link className="btn-secondary" href={`/admin/rehearsals/${rehearsal.id}?page=${page + 1}`}>Next members</Link>}
    </nav>
  </section>
}
