'use client'
import { useActionState } from 'react'
import { saveClubSettingsAction } from '@/app/admin/settings/actions'
import { SubmitButton } from '@/components/submit-button'
import type { ClubSettings } from '@/lib/validation/admin'

export function SettingsForm({ settings }: { settings: ClubSettings }) {
  const [state, action] = useActionState(saveClubSettingsAction, {})
  return <form action={action} className="card space-y-5">
    <div><label className="label" htmlFor="clubName">Club name</label><input className="input" id="clubName" name="clubName" maxLength={80} defaultValue={settings.clubName} required /></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="attendanceThreshold">Attendance threshold (%)</label><input className="input" id="attendanceThreshold" name="attendanceThreshold" type="number" min={0} max={100} step={1} defaultValue={settings.attendanceThreshold} required /></div>
      <div><label className="label" htmlFor="absenceDeadlineHours">Absence deadline (hours after rehearsal)</label><input className="input" id="absenceDeadlineHours" name="absenceDeadlineHours" type="number" min={0} max={720} step={1} defaultValue={settings.absenceDeadlineHours} required /></div>
      <div><label className="label" htmlFor="graceDays">Subscription grace period (days)</label><input className="input" id="graceDays" name="graceDays" type="number" min={0} max={90} step={1} defaultValue={settings.graceDays} required /></div>
      <div><label className="label" htmlFor="subscriptionBillingPeriod">Subscription billing period</label><select className="input" id="subscriptionBillingPeriod" name="subscriptionBillingPeriod" defaultValue={settings.subscriptionBillingPeriod}><option value="MONTHLY">Monthly</option><option value="TERM">Term</option><option value="YEAR">Year</option></select></div>
    </div>
    <p className="text-sm text-slate-600">These settings apply to club records and future subscription periods. Fee amounts are managed separately.</p>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p className="text-emerald-800" role="status">Settings saved.</p>}
    <SubmitButton>Save settings</SubmitButton>
  </form>
}
