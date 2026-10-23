import 'server-only'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { z } from 'zod'

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
})

export function getFirebaseAdminMessaging() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.')

    const parsed = serviceAccountSchema.parse(JSON.parse(rawServiceAccount))
    initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
    })
  }
  return getMessaging()
}
