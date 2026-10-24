import 'server-only'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { parseNairobiDate } from '@/lib/dates'
import { festivalsRepository } from './repository'
import type { FestivalCreateInput, FestivalUpdateInput } from './schema'

export class FestivalServiceError extends Error {}

function mapError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new FestivalServiceError('Festival not found.')
  }
  throw error
}

function dateAtNairobi(date: string | null) {
  return date ? parseNairobiDate(date) : null
}

function dateFields(input: { startDate: string | null; endDate: string | null }) {
  return {
    startDate: dateAtNairobi(input.startDate),
    endDate: dateAtNairobi(input.endDate),
  }
}

export async function listFestivals() {
  return festivalsRepository.list()
}

export async function getFestival(festivalId: string) {
  return festivalsRepository.find(festivalId)
}

export async function createFestival(input: FestivalCreateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const festival = await festivalsRepository.create(tx, {
      name: input.name,
      year: input.year,
      organizer: input.organizer || null,
      venue: input.venue || null,
      ...dateFields(input),
      notes: input.notes || null,
      createdById: actorId,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_CREATED',
      entity: 'Festival',
      entityId: festival.id,
      details: { name: festival.name, year: festival.year },
    })
    return festival
  }).catch(mapError)
}

export async function updateFestival(input: FestivalUpdateInput, actorId: string) {
  return festivalsRepository.transaction(async (tx) => {
    const previous = await festivalsRepository.findForUpdate(tx, input.festivalId)
    if (!previous) throw new FestivalServiceError('Festival not found.')

    const festival = await festivalsRepository.update(tx, input.festivalId, {
      name: input.name,
      year: input.year,
      organizer: input.organizer || null,
      venue: input.venue || null,
      ...dateFields(input),
      status: input.status,
      notes: input.notes || null,
    })
    await writeAuditLog(tx, {
      actorId,
      action: 'FESTIVAL_UPDATED',
      entity: 'Festival',
      entityId: festival.id,
      details: {
        from: { name: previous.name, year: previous.year, status: previous.status },
        to: { name: festival.name, year: festival.year, status: festival.status },
      },
    })
    return festival
  }).catch(mapError)
}
