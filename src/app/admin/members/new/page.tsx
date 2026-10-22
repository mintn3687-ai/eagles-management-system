import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { MemberForm } from '@/components/members/member-form'
export default async function NewMemberPage() {
  await pageUser('COMMITTEE')
  return <div className="space-y-5"><Link className="inline-flex min-h-11 items-center underline" href="/admin/members">Back to members</Link><section className="card"><h1>Add member</h1><p className="mb-6 text-slate-600">New members start as pending registration. Tick “Existing member” for someone already registered.</p><MemberForm /></section></div>
}
