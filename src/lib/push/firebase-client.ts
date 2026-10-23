'use client'

import { getApp, getApps, initializeApp } from '@firebase/app'
import { getMessaging, isSupported, type Messaging } from '@firebase/messaging'

let messaging: Promise<Messaging | null> | undefined

export function getClientMessaging(): Promise<Messaging | null> {
  messaging ??= (async () => {
    if (!(await isSupported())) return null

    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
    if (Object.values(config).some((value) => !value)) {
      throw new Error('Firebase web configuration is incomplete.')
    }

    const app = getApps().length ? getApp() : initializeApp(config)
    return getMessaging(app)
  })()
  return messaging
}
