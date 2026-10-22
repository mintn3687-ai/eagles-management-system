'use server'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { loginSchema } from '@/lib/validation/auth'
import type { FormState } from '@/lib/form-state'

export async function loginAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') })
  if (!parsed.success) return { error: 'Email or password is incorrect, or sign-in is temporarily unavailable. Please try again.' }
  try {
    // Authentication is performed by the Credentials provider, never by a browser-supplied user ID.
    await signIn('credentials', { ...parsed.data, redirectTo: '/member' })
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Email or password is incorrect, or sign-in is temporarily unavailable. Please try again.' }
    throw error
  }
  return {}
}
