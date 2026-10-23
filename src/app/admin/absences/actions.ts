'use server'

import {
  reviewSingleAction as reviewSingle,
  reviewBulkAction as reviewBulk,
} from '@/modules/absences/actions'
import type { AbsenceListState } from '@/modules/absences/actions'

export type { AbsenceListState }

export async function reviewSingleAction(state: AbsenceListState, form: FormData) {
  return reviewSingle(state, form)
}

export async function reviewBulkAction(state: AbsenceListState, form: FormData) {
  return reviewBulk(state, form)
}
