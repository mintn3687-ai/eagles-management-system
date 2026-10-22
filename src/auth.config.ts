import type { NextAuthConfig } from 'next-auth'

// This config is also used at the edge; keep database and bcrypt imports out.
export default {
  providers: [],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.passwordVersion = user.passwordVersion
      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.passwordVersion = typeof token.passwordVersion === 'string' ? token.passwordVersion : undefined
      }
      return session
    },
    authorized({ auth }) { return Boolean(auth?.user?.id) },
  },
} satisfies NextAuthConfig
