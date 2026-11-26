'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

type NavIcon = 'home' | 'users' | 'theater' | 'card' | 'calendar' | 'ballot' | 'film' | 'tent' | 'coins' | 'chart' | 'check' | 'receipt' | 'clipboard' | 'settings' | 'user' | 'refresh' | 'download' | 'more'
type NavItem = { href: string; label: string; icon: NavIcon }

const iconShapes: Record<NavIcon, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  theater: <><path d="M3 5h18v12H3z" /><path d="M7 10h.01M17 10h.01M8 14c1.2 1.3 2.8 1.3 4 0M14 14c1.2 1.3 2.8 1.3 4 0" /><path d="M8 17v3m8-3v3" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  ballot: <><path d="M8 4h8l2 4H6zM5 9h14v12H5z" /><path d="m9 15 2 2 4-4" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4" /></>,
  tent: <><path d="m3 20 9-16 9 16H3zM12 4v16m-4-7h8" /></>,
  coins: <><ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v5c0 1.66 2.69 3 6 3a11 11 0 0 0 3-.4M3 11v5c0 1.66 2.69 3 6 3a11 11 0 0 0 3-.4" /><ellipse cx="17" cy="15" rx="4" ry="2" /><path d="M13 15v4c0 1.1 1.79 2 4 2s4-.9 4-2v-4" /></>,
  chart: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
  check: <><path d="M20 11v1a8 8 0 1 1-4.75-7.32" /><path d="m8 11 4 4L21 5" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8 9h8M8 13h8M8 17h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
}

function NavigationIcon({ name }: { name: NavIcon }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconShapes[name]}</svg>
}

export function AppSectionSubtitle() {
  const pathname = usePathname()
  const label = pathname.startsWith('/admin') ? 'Committee' : pathname.startsWith('/member') ? 'Member' : 'Club portal'
  return <span className="phone-brand-subtitle">{label}</span>
}

const committeeTabs: NavItem[] = [
  { href: '/admin', label: 'Home', icon: 'home' },
  { href: '/admin/members', label: 'Members', icon: 'users' },
  { href: '/admin/rehearsals', label: 'Rehearsals', icon: 'theater' },
  { href: '/admin/payments', label: 'Payments', icon: 'card' },
]

const committeeMore: NavItem[] = [
  { href: '/admin/meetings', label: 'Meetings', icon: 'calendar' },
  { href: '/admin/elections', label: 'Elections', icon: 'ballot' },
  { href: '/admin/productions', label: 'Productions', icon: 'film' },
  { href: '/admin/festivals', label: 'Festivals', icon: 'tent' },
  { href: '/admin/finance', label: 'Finance', icon: 'coins' },
  { href: '/admin/analytics', label: 'Attendance', icon: 'chart' },
  { href: '/admin/absences', label: 'Absences', icon: 'check' },
  { href: '/admin/fees', label: 'Fees', icon: 'receipt' },
  { href: '/admin/audit', label: 'Audit log', icon: 'clipboard' },
]

const memberTabs: NavItem[] = [
  { href: '/member', label: 'Home', icon: 'home' },
  { href: '/member/attendance', label: 'Attendance', icon: 'check' },
  { href: '/member/fees', label: 'Payments', icon: 'card' },
  { href: '/member/meetings', label: 'Meetings', icon: 'calendar' },
]

const memberMore: NavItem[] = [
  { href: '/member/productions', label: 'Productions', icon: 'theater' },
  { href: '/member/elections', label: 'Elections', icon: 'ballot' },
  { href: '/member/stats', label: 'My stats', icon: 'chart' },
  { href: '/member/history', label: 'Attendance history', icon: 'clipboard' },
  { href: '/member/reimbursements', label: 'Reimbursements', icon: 'coins' },
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
      { href: '/admin/settings', label: 'Settings', icon: 'settings' as const },
      { href: '/admin/team', label: 'Team', icon: 'user' as const },
      { href: '/admin/rollover', label: 'Season rollover', icon: 'refresh' as const },
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
        <span><NavigationIcon name={item.icon} /></span>{item.label}
      </Link>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
        <span><NavigationIcon name="more" /></span>More
      </button>
    </nav>
    {moreOpen && <div className="app-more-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setMoreOpen(false) }}>
      <section className="app-more-sheet" role="dialog" aria-modal="true" aria-labelledby="app-more-title">
        <div className="app-more-grab" aria-hidden="true" />
        <h2 id="app-more-title">More</h2>
        <nav className="app-more-grid" aria-label="More pages">
          {more.map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}>
            <span><NavigationIcon name={item.icon} /></span>{item.label}
          </Link>)}
          {variant === 'committee' && isSuperAdmin && <a href="/admin/export"><span><NavigationIcon name="download" /></span>Export all data</a>}
        </nav>
        {signOut && <div className="app-more-actions">{variant === 'committee' && <Link className="btn-secondary" href="/member">Member home</Link>}{signOut}</div>}
        <button className="app-more-close" type="button" onClick={() => setMoreOpen(false)}>Close</button>
      </section>
    </div>}
  </>
}
