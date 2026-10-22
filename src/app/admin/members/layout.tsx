import Link from 'next/link'
import { ReactNode } from 'react'

export default function MembersLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center underline" href="/admin">← Committee home</Link>
    {children}
  </div>
}