import { findUsableInvite } from '@/lib/auth/invites'
import { InviteForm } from '@/components/invite-form'
export const dynamic = 'force-dynamic'
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await findUsableInvite(token)
  return <section className="card mx-auto max-w-lg"><h1>{invite ? 'You’re invited' : 'Invitation unavailable'}</h1>{invite ? <><p className="mb-6 text-slate-600">Set a password for your Eagles Drama Club account.</p><InviteForm token={token} /></> : <p>This invitation is invalid, expired, or already used. Ask the committee for a new one.</p>}</section>
}
