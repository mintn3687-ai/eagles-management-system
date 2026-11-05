'use server'

import { revalidatePath } from 'next/cache'
import { createInvite } from '@/lib/auth/create-invite'
import { logUnexpectedMemberError, memberErrorMessage } from '@/lib/members/errors'
import { CSV_MAX_BYTES, CsvError, type CsvPreviewRow } from '@/lib/members/csv'
import { requirePermission } from '@/lib/permissions'
import { userIdSchema } from '@/lib/validation'
import { getMemberInviteTarget } from './service'
import { createMember, editMember, changeMemberStatus, changeUserRole } from './mutation-service'
import { importMembers, previewMemberImport } from './import-service'
import { memberCreateSchema, memberDetailsSchema, memberImportSourceSchema, roleChangeSchema, statusChangeSchema } from './schema'

export type MemberFormState = {
  error?: string
  success?: boolean
  memberId?: string
  invitePath?: string
  name?: string
  phone?: string
}

function details(form: FormData) {
  return Object.fromEntries(['fullName', 'phone', 'email', 'studentRegNo', 'emergencyContactName', 'emergencyContactPhone', 'notes'].map((key) => [key, form.get(key) ?? '']))
}

export async function createMemberAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    const actor = await requirePermission('members:manage')
    const parsed = memberCreateSchema.safeParse({ ...details(form), existingMember: form.get('existingMember') === 'on' })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the member details.' }
    const result = await createMember(parsed.data, actor.id)
    revalidatePath('/admin/members')
    return { ...result, success: true }
  } catch (error) {
    logUnexpectedMemberError('create', error)
    return { error: memberErrorMessage(error) }
  }
}

export async function editMemberAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    const actor = await requirePermission('members:manage')
    const id = userIdSchema.safeParse(form.get('memberId'))
    const parsed = memberDetailsSchema.safeParse(details(form))
    if (!id.success || !parsed.success) return { error: !id.success ? 'Member not found.' : parsed.error?.issues[0]?.message ?? 'Check the member details.' }
    await editMember(id.data, parsed.data, actor.id)
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) {
    logUnexpectedMemberError('edit', error)
    return { error: memberErrorMessage(error) }
  }
}

export async function statusAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    const actor = await requirePermission('members:manage')
    const id = userIdSchema.safeParse(form.get('memberId'))
    const parsed = statusChangeSchema.safeParse({ status: form.get('status'), reason: form.get('reason') ?? '' })
    if (!id.success || !parsed.success) return { error: !id.success ? 'Member not found.' : parsed.error?.issues[0]?.message ?? 'Check the status change.' }
    await changeMemberStatus(id.data, parsed.data, actor.id)
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}

export async function roleAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    const actor = await requirePermission('team:manage')
    const id = userIdSchema.safeParse(form.get('memberId'))
    const parsed = roleChangeSchema.safeParse({ role: form.get('role') })
    if (!id.success || !parsed.success) return { error: !id.success ? 'Member not found.' : parsed.error?.issues[0]?.message ?? 'Choose a valid role.' }
    await changeUserRole(id.data, parsed.data.role, actor.id)
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}

export async function memberInviteAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requirePermission('members:manage')
    const parsed = userIdSchema.safeParse(form.get('memberId'))
    if (!parsed.success) return { error: 'Member not found.' }
    const member = await getMemberInviteTarget(parsed.data)
    if (!member) return { error: 'Member not found.' }
    if (!member.userId) return { error: 'This member has no linked login account.' }
    const invite = await createInvite(member.userId)
    return { success: true, invitePath: invite.path, name: member.fullName, phone: member.phone }
  } catch (error) { return { error: memberErrorMessage(error) } }
}

export type ImportState = { error?: string; rows?: CsvPreviewRow[]; source?: string; imported?: number }

export async function previewImportAction(_state: ImportState, form: FormData): Promise<ImportState> {
  try {
    await requirePermission('members:manage')
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > CSV_MAX_BYTES) return { error: 'Choose a CSV file up to 500 KB.' }
    const source = await file.text()
    const parsed = memberImportSourceSchema.safeParse(source)
    if (!parsed.success) return { error: 'The CSV file is too large or empty.' }
    return { rows: await previewMemberImport(parsed.data), source }
  } catch (error) { return { error: error instanceof CsvError ? error.message : memberErrorMessage(error) } }
}

export async function confirmImportAction(_state: ImportState, form: FormData): Promise<ImportState> {
  try {
    const actor = await requirePermission('members:manage')
    const parsed = memberImportSourceSchema.safeParse(form.get('source'))
    if (!parsed.success) return { error: 'Upload a valid CSV file before importing.' }
    const imported = await importMembers(parsed.data, actor.id)
    revalidatePath('/admin/members')
    return { imported }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
