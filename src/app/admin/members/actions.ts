'use server'
import { revalidatePath } from 'next/cache'
import { createMember, editMember, changeMemberStatus, changeUserRole } from '@/lib/members/service'
import { memberErrorMessage } from '@/lib/members/errors'
import { createInvite } from '@/lib/auth/create-invite'
import { requireRole } from '@/lib/permissions'
import { userIdSchema } from '@/lib/validation'
import { prisma } from '@/lib/db'
import { importMembers, previewMemberImport } from '@/lib/members/import'
import { CSV_MAX_BYTES, CsvError, type CsvPreviewRow } from '@/lib/members/csv'

export type MemberFormState = { error?: string; success?: boolean; memberId?: string; invitePath?: string; name?: string; phone?: string }
function details(form: FormData) {
  return Object.fromEntries(['fullName', 'phone', 'email', 'studentRegNo', 'emergencyContactName', 'emergencyContactPhone', 'notes'].map((key) => [key, form.get(key) ?? '']))
}
export async function createMemberAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requireRole('COMMITTEE')
    const result = await createMember({ ...details(form), existingMember: form.get('existingMember') === 'on' })
    revalidatePath('/admin/members')
    return { ...result, success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
export async function editMemberAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requireRole('COMMITTEE')
    await editMember(form.get('memberId'), details(form))
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
export async function statusAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requireRole('COMMITTEE')
    await changeMemberStatus(form.get('memberId'), { status: form.get('status'), reason: form.get('reason') ?? '' })
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
export async function roleAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requireRole('SUPER_ADMIN')
    await changeUserRole(form.get('memberId'), { role: form.get('role') })
    revalidatePath('/admin/members', 'layout')
    return { success: true }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
export async function memberInviteAction(_state: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    await requireRole('COMMITTEE')
    const id = userIdSchema.parse(form.get('memberId'))
    const member = await prisma.member.findUniqueOrThrow({ where: { id }, select: { userId: true, fullName: true, phone: true } })
    if (!member.userId) return { error: 'This member has no linked login account.' }
    const invite = await createInvite(member.userId)
    return { success: true, invitePath: invite.path, name: member.fullName, phone: member.phone }
  } catch (error) { return { error: memberErrorMessage(error) } }
}

export type ImportState = { error?: string; rows?: CsvPreviewRow[]; source?: string; imported?: number }
export async function previewImportAction(_state: ImportState, form: FormData): Promise<ImportState> {
  try {
    await requireRole('COMMITTEE')
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > CSV_MAX_BYTES) return { error: 'Choose a CSV file up to 500 KB.' }
    const source = await file.text()
    return { rows: await previewMemberImport(source), source }
  } catch (error) { return { error: error instanceof CsvError ? error.message : memberErrorMessage(error) } }
}
export async function confirmImportAction(_state: ImportState, form: FormData): Promise<ImportState> {
  try {
    await requireRole('COMMITTEE')
    const imported = await importMembers(form.get('source'))
    revalidatePath('/admin/members')
    return { imported }
  } catch (error) { return { error: memberErrorMessage(error) } }
}
