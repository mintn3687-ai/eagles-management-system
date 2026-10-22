import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { ImportForm } from '@/components/members/import-form'
export default async function ImportPage() {
  await pageUser('COMMITTEE')
  return <div className="space-y-5"><Link className="inline-flex min-h-11 items-center underline" href="/admin/members">Back to members</Link><section className="card space-y-5"><div><h1>Import members</h1><p>Use these four column headings: <code className="break-all">fullName,phone,email,studentRegNo</code>.</p><p className="mt-3 text-sm text-slate-600">Imported members start as pending registration. Emergency contacts can be completed on each member’s record. Nothing is saved until you confirm a valid preview.</p></div><ImportForm /></section></div>
}
