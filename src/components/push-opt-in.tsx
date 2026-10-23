'use client'

import { useEffect, useState } from 'react'
import { getToken } from '@firebase/messaging'
import { getClientMessaging } from '@/lib/push/firebase-client'

type SubscriptionState = 'loading' | 'enabled' | 'disabled' | 'unsupported'

async function getBrowserToken(messaging: NonNullable<Awaited<ReturnType<typeof getClientMessaging>>>) {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) throw new Error('Notifications are not configured for this site yet.')
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('The browser did not create a notification subscription.')
  return token
}

async function saveSubscription(method: 'POST' | 'DELETE', token: string) {
  const response = await fetch('/api/push/subscription', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Could not update notification settings.')
}

export function PushOptIn() {
  const [state, setState] = useState<SubscriptionState>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsHomeScreenInstall, setNeedsHomeScreenInstall] = useState(false)

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    setNeedsHomeScreenInstall(ios && !standalone)

    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    const loadSubscription = async () => {
      if (Notification.permission !== 'granted') {
        setState('disabled')
        return
      }
      try {
        const messaging = await getClientMessaging()
        if (!messaging) throw new Error('Push notifications are not supported in this browser.')
        const token = await getBrowserToken(messaging)
        const response = await fetch('/api/push/subscription', {
          headers: { 'X-Push-Token': token },
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Could not check notification settings.')
        const result: { enabled: boolean } = await response.json()
        setState(result.enabled ? 'enabled' : 'disabled')
      } catch (error) {
        setState('disabled')
        setMessage(error instanceof Error ? error.message : 'Could not check notification settings. Please reload and try again.')
      }
    }
    void loadSubscription()
  }, [])

  async function toggleNotifications() {
    setBusy(true)
    setMessage('')
    try {
      if (needsHomeScreenInstall) {
        setMessage('On iPhone or iPad, add this app to your Home Screen first, then open it there to enable notifications.')
        return
      }
      if (state === 'enabled') {
        const messaging = await getClientMessaging()
        if (!messaging) throw new Error('This browser does not support push notifications.')
        const token = await getBrowserToken(messaging)
        await saveSubscription('DELETE', token)
        setState('disabled')
        setMessage('Notifications are off on this device.')
        return
      }

      if (Notification.permission === 'denied') {
        setMessage('Notifications are blocked in your browser settings. Allow them there, then try again.')
        return
      }
      const messaging = await getClientMessaging()
      if (!messaging) throw new Error('This browser does not support push notifications.')
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      if (!vapidKey) throw new Error('Notifications are not configured for this site yet.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage('Notifications were not enabled.')
        return
      }
      const token = await getBrowserToken(messaging)
      await saveSubscription('POST', token)
      setState('enabled')
      setMessage('Notifications are on for this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update notifications. Check your connection and browser settings, then try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="push-opt-in-title">
    <h2 id="push-opt-in-title" className="text-base font-semibold">Club notifications</h2>
    <p className="mt-1 text-sm text-slate-600">Get rehearsal reminders and important club updates on this device. Notification text stays general.</p>
    {state !== 'unsupported' && <button
      className="btn-secondary mt-3"
      type="button"
      onClick={toggleNotifications}
      disabled={busy || state === 'loading'}
    >{busy ? 'Updating…' : state === 'enabled' ? 'Turn notifications off' : 'Enable notifications'}</button>}
    {state === 'unsupported' && <p className="mt-3 text-sm text-slate-600">Push notifications are not supported in this browser.</p>}
    {message && <p className="mt-3 text-sm text-slate-600" role="status">{message}</p>}
  </section>
}
