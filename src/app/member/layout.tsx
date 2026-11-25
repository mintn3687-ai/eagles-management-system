import type { ReactNode } from 'react'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { SignOut } from '@/components/sign-out'

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <div className="member-page space-y-5">
    {children}
    <AppBottomNav variant="member" signOut={<SignOut />} />
  </div>
}
