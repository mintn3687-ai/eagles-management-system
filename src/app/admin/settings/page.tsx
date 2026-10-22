import { pageUser } from '@/lib/page-access'
import { getClubSettings } from '@/lib/admin-settings'
import { SettingsForm } from '@/components/admin/settings-form'

export default async function AdminSettingsPage() {
  await pageUser('SUPER_ADMIN')
  const settings = await getClubSettings()
  return <div className="space-y-5">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Super Admin</p><h1>Club settings</h1><p className="text-slate-600">Manage the values used by attendance and subscription pages.</p></div>
    <SettingsForm settings={settings} />
  </div>
}
