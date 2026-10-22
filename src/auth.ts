import NextAuth from 'next-auth'
import type { NextAuthResult } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import authConfig from './auth.config'
import { authenticateCredentials } from './lib/auth/credentials'

const authResult: NextAuthResult = NextAuth({
  ...authConfig,
  providers: [Credentials({
    credentials: { email: { type: 'email' }, password: { type: 'password' } },
    authorize: (credentials, request) => authenticateCredentials(credentials, request),
  })],
})

export const auth: NextAuthResult['auth'] = authResult.auth
export const handlers: NextAuthResult['handlers'] = authResult.handlers
export const signIn: NextAuthResult['signIn'] = authResult.signIn
export const signOut: NextAuthResult['signOut'] = authResult.signOut
