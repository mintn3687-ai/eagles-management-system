import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { WeeklyGeneratorForm } from '@/components/rehearsals/weekly-form'

export default async function GenerateWeeklyPage() {
  await pageUser('COMMITTEE')
  return <div className="space-y-6">
    <div>
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/rehearsals">← Rehearsals</Link>
      <h1>Generate weekly rehearsals</h1>
      <p className="text-slate-600">Create multiple rehearsals on the same weekday over a date range.</p>
    </div>
    <WeeklyGeneratorForm />
  </div>
}
