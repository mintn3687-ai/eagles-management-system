import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import authConfig from './auth.config'
import { authenticateCredentials } from './lib/auth/credentials'

export const { auth, handlers, signIn, signOut } = (NextAuth as any)({
  ...authConfig,
  providers: [Credentials({
    credentials: { email: { type: 'email' }, password: { type: 'password' } },
    authorize: (credentials, request) => authenticateCredentials(credentials, request),
  })],
})
