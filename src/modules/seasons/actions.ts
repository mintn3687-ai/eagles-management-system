'use server'

import { revalidatePath } from 'next/cache'
import { AccessError, requirePermission } from '@/lib/permissions'
import { seasonCreateSchema } from './schema'
import { createNextSeason, SeasonServiceError } from './service'

export type SeasonActionState = { success?: boolean; message?: string; error?: string }

export async function createSeasonAction(_state: SeasonActionState, form: FormData): Promise<SeasonActionState> {
  try {
    const actor = await requirePermission('seasons:manage')
    const parsed = seasonCreateSchema.safeParse({
      name: form.get('name'),
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      memberIds: form.getAll('memberIds'),
      status: form.get('status'),
      confirmation: form.get('confirmation'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the season details and try again.' }

    const result = await createNextSeason(parsed.data, actor.id)
    revalidatePath('/admin/rollover')
    revalidatePath('/admin/members', 'layout')
    revalidatePath('/admin/analytics', 'layout')
    return {
      success: true,
      message: `${parsed.data.name} created with ${result.memberCount} carried member${result.memberCount === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    if (error instanceof SeasonServiceError) return { error: error.message }
    if (error instanceof AccessError) return { error: error.message }
    return { error: 'Could not create the new season. Please try again.' }
  }
}
