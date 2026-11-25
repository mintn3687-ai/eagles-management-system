import { pageUser } from '@/lib/page-access'
import { ReactNode } from 'react'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { SignOut } from '@/components/sign-out'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await pageUser('COMMITTEE')
  return <div className="admin-page space-y-5">
    {children}
    <AppBottomNav variant="committee" isSuperAdmin={actor.role === 'SUPER_ADMIN'} signOut={<SignOut />} />
  </div>
}
