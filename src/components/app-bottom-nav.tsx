'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

type NavItem = { href: string; label: string; icon: string }

export function AppSectionSubtitle() {
  const pathname = usePathname()
  const label = pathname.startsWith('/admin') ? 'Committee' : pathname.startsWith('/member') ? 'Member' : 'Club portal'
  return <span className="phone-brand-subtitle">{label}</span>
}

const committeeTabs: NavItem[] = [
  { href: '/admin', label: 'Home', icon: '🏠' },
  { href: '/admin/members', label: 'Members', icon: '👥' },
  { href: '/admin/rehearsals', label: 'Rehearsals', icon: '🎭' },
  { href: '/admin/payments', label: 'Payments', icon: '💳' },
]

const committeeMore: NavItem[] = [
  { href: '/admin/meetings', label: 'Meetings', icon: '🗓️' },
  { href: '/admin/elections', label: 'Elections', icon: '🗳️' },
  { href: '/admin/productions', label: 'Productions', icon: '🎬' },
  { href: '/admin/festivals', label: 'Festivals', icon: '🎪' },
  { href: '/admin/finance', label: 'Finance', icon: '💰' },
  { href: '/admin/analytics', label: 'Attendance', icon: '📊' },
  { href: '/admin/absences', label: 'Absences', icon: '✅' },
  { href: '/admin/fees', label: 'Fees', icon: '🧾' },
  { href: '/admin/audit', label: 'Audit log', icon: '📋' },
]

const memberTabs: NavItem[] = [
  { href: '/member', label: 'Home', icon: '🏠' },
  { href: '/member/attendance', label: 'Attendance', icon: '✅' },
  { href: '/member/fees', label: 'Payments', icon: '💳' },
  { href: '/member/meetings', label: 'Meetings', icon: '🗓️' },
]

const memberMore: NavItem[] = [
  { href: '/member/productions', label: 'Productions', icon: '🎭' },
  { href: '/member/elections', label: 'Elections', icon: '🗳️' },
  { href: '/member/stats', label: 'My stats', icon: '📊' },
  { href: '/member/history', label: 'Attendance history', icon: '🕘' },
  { href: '/member/reimbursements', label: 'Reimbursements', icon: '💰' },
]

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/admin' && href !== '/member' && pathname.startsWith(`${href}/`))
}

export function AppBottomNav({ variant, isSuperAdmin = false, signOut }: {
  variant: 'committee' | 'member'
  isSuperAdmin?: boolean
  signOut?: ReactNode
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const tabs = variant === 'committee' ? committeeTabs : memberTabs
  const more = variant === 'committee'
    ? [...committeeMore, ...(isSuperAdmin ? [
      { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
      { href: '/admin/team', label: 'Team', icon: '👤' },
      { href: '/admin/rollover', label: 'Season rollover', icon: '🔄' },
    ] : [])]
    : memberMore

  useEffect(() => {
    if (!moreOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [moreOpen])

  return <>
    <nav className="app-bottom-nav" aria-label={variant === 'committee' ? 'Committee navigation' : 'Member navigation'}>
      {tabs.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
        <span aria-hidden="true">{item.icon}</span>{item.label}
      </Link>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
        <span aria-hidden="true">⋯</span>More
      </button>
    </nav>
    {moreOpen && <div className="app-more-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setMoreOpen(false) }}>
      <section className="app-more-sheet" role="dialog" aria-modal="true" aria-labelledby="app-more-title">
        <div className="app-more-grab" aria-hidden="true" />
        <h2 id="app-more-title">More</h2>
        <nav className="app-more-grid" aria-label="More pages">
          {more.map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}>
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </Link>)}
          {variant === 'committee' && isSuperAdmin && <a href="/admin/export"><span aria-hidden="true">📥</span>Export all data</a>}
        </nav>
        {signOut && <div className="app-more-actions">{variant === 'committee' && <Link className="btn-secondary" href="/member">Member home</Link>}{signOut}</div>}
        <button className="app-more-close" type="button" onClick={() => setMoreOpen(false)}>Close</button>
      </section>
    </div>}
  </>
}
