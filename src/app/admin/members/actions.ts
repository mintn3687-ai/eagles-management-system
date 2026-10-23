'use server'

import {
  createMemberAction as createMember,
  editMemberAction as editMember,
  statusAction as changeStatus,
  roleAction as changeRole,
  memberInviteAction as inviteMember,
  previewImportAction as previewImport,
  confirmImportAction as confirmImport,
} from '@/modules/members/actions'
import type { ImportState, MemberFormState } from '@/modules/members/actions'

export type { ImportState, MemberFormState }

export async function createMemberAction(state: MemberFormState, form: FormData) {
  return createMember(state, form)
}

export async function editMemberAction(state: MemberFormState, form: FormData) {
  return editMember(state, form)
}

export async function statusAction(state: MemberFormState, form: FormData) {
  return changeStatus(state, form)
}

export async function roleAction(state: MemberFormState, form: FormData) {
  return changeRole(state, form)
}

export async function memberInviteAction(state: MemberFormState, form: FormData) {
  return inviteMember(state, form)
}

export async function previewImportAction(state: ImportState, form: FormData) {
  return previewImport(state, form)
}

export async function confirmImportAction(state: ImportState, form: FormData) {
  return confirmImport(state, form)
}
