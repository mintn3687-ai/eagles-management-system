import 'server-only'
import { consentRepository } from './repository'

export async function acceptConsent(userId: string, acceptedAt = new Date()) {
  await consentRepository.accept(userId, acceptedAt)
}
