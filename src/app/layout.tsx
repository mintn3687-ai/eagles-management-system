import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { InstallApp } from './install-app'
import { ServiceWorkerRegistration } from './service-worker-registration'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Eagles Drama Club Register', template: '%s | Eagles Drama Club' },
  description: 'The members-only register for Eagles Drama Club.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Eagles Register', statusBarStyle: 'default' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#064e3b' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    <header className="border-b border-emerald-900/10 bg-white"><div className="mx-auto max-w-3xl px-5 py-5 sm:px-8"><Link href="/" className="inline-flex min-h-11 items-center gap-3 font-semibold text-emerald-950"><span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-emerald-900 text-sm tracking-wider text-white">ED</span><span>Eagles Drama Club<span className="block text-xs font-normal tracking-wide text-slate-500">MEMBERS’ REGISTER</span></span></Link></div></header>
    <InstallApp />
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">{children}</main>
    <footer className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 pb-8 text-sm text-slate-500 sm:px-8"><span>Eagles Drama Club · All times in Africa/Nairobi</span><Link href="/privacy" className="min-h-11 inline-flex items-center underline underline-offset-4">Privacy</Link></footer>
    <ServiceWorkerRegistration />
  </body></html>
}
