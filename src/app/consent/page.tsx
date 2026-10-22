import { redirect } from 'next/navigation'
import { pageUser } from '@/lib/page-access'
import { isRestricted } from '@/lib/permissions'
import { ConsentForm } from '@/components/consent-form'
import { SignOut } from '@/components/sign-out'
export default async function ConsentPage() {
  const user = await pageUser()
  if (isRestricted(user)) redirect('/member')
  if (user.consentAcceptedAt) redirect('/member')
  return <section className="card space-y-6"><div><h1>Before you continue</h1><p className="text-slate-600">Please read how the club uses your information. If you have questions or do not wish to agree, sign out and contact the committee.</p></div><ConsentForm /><SignOut /></section>
}
