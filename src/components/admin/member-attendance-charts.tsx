import { attendancePercent } from '@/lib/attendance-analytics'

type MemberAttendanceRow = {
  memberId: string
  memberName: string
  present: number
  missed: number
}

export function MemberAttendanceCharts({
  rows,
  monthLabel,
}: {
  rows: MemberAttendanceRow[]
  monthLabel: string
}) {
  const maxResponses = Math.max(1, ...rows.map((row) => row.present + row.missed))

  return <>
    <section className="card space-y-4" aria-labelledby="member-attendance-counts">
      <div>
        <h2 id="member-attendance-counts">Present and missed by member</h2>
        <p className="text-sm text-slate-600">
          All active members for {monthLabel}. Bars compare present and unexcused or unanswered attendance; excused absences are excluded.
        </p>
      </div>
      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2" role="region" aria-label="Present and missed attendance chart by member">
        {rows.length ? rows.map((row) => {
          const presentWidth = row.present / maxResponses * 100
          const missedWidth = row.missed / maxResponses * 100
          return <div className="grid gap-1 sm:grid-cols-[minmax(9rem,14rem)_minmax(8rem,1fr)_8rem] sm:items-center sm:gap-3" key={row.memberId}>
            <p className="break-words text-sm font-medium">{row.memberName}</p>
            <div className="flex h-5 overflow-hidden rounded bg-stone-100" role="img" aria-label={`${row.memberName}: ${row.present} present, ${row.missed} missed`}>
              {row.present > 0 && <span className="h-full bg-emerald-700" style={{ width: `${presentWidth}%` }} />}
              {row.missed > 0 && <span className="h-full bg-rose-600" style={{ width: `${missedWidth}%` }} />}
            </div>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-emerald-800">{row.present} present</span>
              {' · '}
              <span className="font-semibold text-rose-800">{row.missed} missed</span>
            </p>
          </div>
        }) : <p className="text-sm text-slate-600">No active members to chart.</p>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm" aria-label="Chart legend">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-700" aria-hidden="true" />Present</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-rose-600" aria-hidden="true" />Missed</span>
      </div>
    </section>

    <section className="card space-y-4" aria-labelledby="member-attendance-percentages">
      <div>
        <h2 id="member-attendance-percentages">Attendance percentage by member</h2>
        <p className="text-sm text-slate-600">
          Percentage is present ÷ (present + missed). Excused absences do not count.
        </p>
      </div>
      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2" role="region" aria-label="Attendance percentage chart by member">
        {rows.length ? rows.map((row) => {
          const percent = attendancePercent(row.present, row.missed)
          return <div className="grid gap-1 sm:grid-cols-[minmax(9rem,14rem)_minmax(8rem,1fr)_4rem] sm:items-center sm:gap-3" key={row.memberId}>
            <p className="break-words text-sm font-medium">{row.memberName}</p>
            <div className="h-5 overflow-hidden rounded bg-stone-100" role="progressbar" aria-label={`${row.memberName} attendance`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className="h-full rounded bg-emerald-700" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-sm font-semibold text-emerald-950">{percent.toFixed(1)}%</p>
          </div>
        }) : <p className="text-sm text-slate-600">No active members to chart.</p>}
      </div>
    </section>
  </>
}
