import type { DefaultSession } from 'next-auth'
declare module 'next-auth' {
  interface User { passwordVersion?: string }
  interface Session { user: DefaultSession['user'] & { id: string; passwordVersion?: string } }
}
declare module 'next-auth/jwt' {
  interface JWT { passwordVersion?: string }
}
