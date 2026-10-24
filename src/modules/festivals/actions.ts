'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import {
  festivalCreateSchema,
  festivalUpdateSchema,
} from './schema'
import {
  createFestival,
  FestivalServiceError,
  updateFestival,
} from './service'

export type FestivalActionState = { success?: boolean; message?: string; error?: string }

function value(form: FormData, key: string) {
  const item = form.get(key)
  return typeof item === 'string' ? item : ''
}

function parseYear(form: FormData) {
  const raw = value(form, 'year').trim()
  return raw ? Number(raw) : Number.NaN
}

function actionError(error: unknown): FestivalActionState {
  if (error instanceof AccessError || error instanceof FestivalServiceError) return { error: error.message }
  throw error
}

function refresh(festivalId?: string) {
  revalidatePath('/admin/festivals')
  if (festivalId) revalidatePath(`/admin/festivals/${festivalId}`)
}

export async function createFestivalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalCreateSchema.safeParse({
      name: value(form, 'name'),
      year: parseYear(form),
      organizer: value(form, 'organizer'),
      venue: value(form, 'venue'),
      startDate: value(form, 'startDate'),
      endDate: value(form, 'endDate'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the festival details.' }
    const festival = await createFestival(parsed.data, actor.id)
    refresh(festival.id)
    return { success: true, message: `Festival “${festival.name}” created.` }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateFestivalAction(_state: FestivalActionState, form: FormData): Promise<FestivalActionState> {
  try {
    const actor = await requirePermission('festivals:manage')
    const parsed = festivalUpdateSchema.safeParse({
      festivalId: value(form, 'festivalId'),
      name: value(form, 'name'),
      year: parseYear(form),
      organizer: value(form, 'organizer'),
      venue: value(form, 'venue'),
      startDate: value(form, 'startDate'),
      endDate: value(form, 'endDate'),
      status: value(form, 'status'),
      notes: value(form, 'notes'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the festival details.' }
    await updateFestival(parsed.data, actor.id)
    refresh(parsed.data.festivalId)
    return { success: true, message: 'Festival details updated.' }
  } catch (error) {
    return actionError(error)
  }
}
