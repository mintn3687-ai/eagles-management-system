'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    const registerServiceWorker = async () => {
      const response = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' })
      const revision = response.headers.get('x-pwa-build-revision')
      if (!response.ok || !revision || !/^[a-f0-9]{40}$/i.test(revision)) {
        throw new Error('A valid Vercel commit SHA was not provided for the service worker')
      }

      await navigator.serviceWorker.register(`/sw.js?revision=${revision}`, { scope: '/' })
    }

    registerServiceWorker().catch((error: unknown) => {
      console.error('Service worker registration failed', error)
    })
  }, [])

  return null
}
