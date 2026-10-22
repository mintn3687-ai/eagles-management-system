'use server'
import { signOut } from '@/auth'
import { requireUser } from '@/lib/permissions'

export async function logoutAction() {
  await requireUser()
  await signOut({ redirectTo: '/login' })
}
