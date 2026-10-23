import 'server-only'
import type { Messaging } from 'firebase-admin/messaging'
import { pushRepository } from './repository'
import { getReminderDateRange, getRehearsalStart } from './reminder-window'

type PushNotice = { title: string; body: string }
type Target = { id: string; userId: string; token: string }
const BATCH_SIZE = 500
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
])

function getErrorCode(error: unknown) {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown'
}

async function sendClaimedBatch(
  messaging: Messaging,
  eventKey: string,
  notice: PushNotice,
  targets: Target[],
) {
  let sent = 0
  let failed = 0
  for (let offset = 0; offset < targets.length; offset += BATCH_SIZE) {
    const batch = targets.slice(offset, offset + BATCH_SIZE)
    let response
    try {
      response = await messaging.sendEachForMulticast({
        tokens: batch.map(({ token }) => token),
        notification: notice,
        data: { url: '/member' },
        webpush: {
          notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: eventKey },
        },
      })
    } catch (error) {
      await Promise.all(batch.map(({ id }) => pushRepository.removeDelivery(id, eventKey)))
      console.error('Push batch failed; pending delivery claims were released.', {
        eventKey,
        errorCode: getErrorCode(error),
      })
      throw error
    }

    for (const [index, result] of response.responses.entries()) {
      const target = batch[index]
      if (result.success) {
        await pushRepository.markDeliverySent(target.id, eventKey)
        sent += 1
        continue
      }

      const errorCode = result.error?.code ?? 'unknown'
      await pushRepository.removeDelivery(target.id, eventKey)
      if (INVALID_TOKEN_CODES.has(errorCode)) {
        await pushRepository.removeSubscriptionById(target.id)
      }
      console.error('Push delivery failed.', { eventKey, subscriptionId: target.id, errorCode })
      failed += 1
    }
  }
  return { sent, failed }
}

export async function sendPushNotice(eventKey: string, notice: PushNotice) {
  const subscriptions = await pushRepository.listEligibleSubscriptions()
  if (!subscriptions.length) return { attempted: 0, sent: 0, failed: 0 }
  const { getFirebaseAdminMessaging } = await import('@/lib/push/firebase-admin')
  const messaging = getFirebaseAdminMessaging()
  const targets: Target[] = []
  for (const subscription of subscriptions) {
    if (await pushRepository.claimDelivery(subscription.id, subscription.userId, eventKey)) {
      targets.push(subscription)
    }
  }
  if (!targets.length) return { attempted: 0, sent: 0, failed: 0 }

  const result = await sendClaimedBatch(messaging, eventKey, notice, targets)
  return { attempted: targets.length, ...result }
}

export function isPushSubscriptionEnabled(userId: string, token: string) {
  return pushRepository.hasSubscription(userId, token)
}

export async function enablePushSubscription(userId: string, token: string) {
  await pushRepository.saveSubscription(userId, token)
}

export async function disablePushSubscription(userId: string, token: string) {
  await pushRepository.removeSubscription(userId, token)
}

export async function sendUpcomingRehearsalReminders(now = new Date()) {
  const { from, through, endsAt } = getReminderDateRange(now)
  const rehearsals = await pushRepository.listScheduledRehearsals(from, through)
  let attempted = 0
  let sent = 0
  let failed = 0

  for (const rehearsal of rehearsals) {
    const startsAt = getRehearsalStart(rehearsal.date, rehearsal.startTime)
    if (startsAt <= now || startsAt > endsAt) continue
    const result = await sendPushNotice(`rehearsal:${rehearsal.id}:daily-24h`, {
      title: 'Eagles Drama Club',
      body: 'A rehearsal is coming up within 24 hours. Sign in to view the details.',
    })
    attempted += result.attempted
    sent += result.sent
    failed += result.failed
  }
  return { attempted, sent, failed }
}
