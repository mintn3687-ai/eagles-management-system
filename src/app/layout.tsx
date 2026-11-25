import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { AppSectionSubtitle } from '@/components/app-bottom-nav'
import { InstallApp } from './install-app'
import { ServiceWorkerRegistration } from './service-worker-registration'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Eagles Drama Club Management System', template: '%s | Eagles Drama Club' },
  description: 'The management system for Eagles Drama Club.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Eagles Management', statusBarStyle: 'default' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1f4b' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" /></head><body>
    <div className="phone-stage">
      <div className="phone-shell">
        <header className="phone-bar"><Link href="/" className="phone-brand"><span className="phone-crest" aria-hidden="true">E</span><span>Eagles Drama Club<AppSectionSubtitle /></span></Link></header>
        <div className="phone-scroll">
          <InstallApp />
          <main className="mx-auto w-full px-4 py-4">{children}</main>
          <footer className="phone-footer"><span>Eagles Drama Club · All times in Africa/Nairobi</span><Link href="/privacy">Privacy</Link></footer>
        </div>
      </div>
    </div>
    <ServiceWorkerRegistration />
  </body></html>
}
