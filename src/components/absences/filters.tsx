'use client'
import Link from 'next/link'
import type { AbsenceFilters } from '@/lib/validation/absences'

export function AbsenceFiltersComponent({ filters }: { filters: AbsenceFilters }) {
  return <section className="card">
    <form className="grid gap-4 sm:grid-cols-4" method="GET">
      <div><label className="label" htmlFor="month">Month</label><input className="input" type="month" id="month" name="month" defaultValue={filters.month ?? ''} /></div>
      <div><label className="label" htmlFor="status">Status</label><select className="input" id="status" name="status" defaultValue={filters.status ?? ''}><option value="">All</option><option value="ABSENT">Absent</option><option value="NO_RESPONSE">No response</option></select></div>
      <div><label className="label" htmlFor="memberId">Member ID</label><input className="input" type="text" id="memberId" name="memberId" defaultValue={filters.memberId ?? ''} placeholder="Member ID" /></div>
      <div><label className="label" htmlFor="rehearsalId">Rehearsal ID</label><input className="input" type="text" id="rehearsalId" name="rehearsalId" defaultValue={filters.rehearsalId ?? ''} placeholder="Rehearsal ID" /></div>
      <div className="sm:col-span-4 flex gap-3"><button className="btn-primary" type="submit">Apply filters</button><Link className="btn-secondary self-center" href="/admin/absences">Clear</Link></div>
    </form>
  </section>
}