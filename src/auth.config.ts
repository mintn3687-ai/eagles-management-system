import type { NextAuthConfig } from 'next-auth'

// This config is also used at the edge; keep database and bcrypt imports out.
// Vercel can expose the production AUTH_URL to Preview deployments when the
// variable is configured for all environments. Auth.js uses AUTH_URL as the
// request origin, which sends Preview sign-ins to production and leaves the
// Preview browser without its session cookie. Resolve the current deployment
// host before Auth.js reads its environment defaults.
if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
  process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`
}

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
