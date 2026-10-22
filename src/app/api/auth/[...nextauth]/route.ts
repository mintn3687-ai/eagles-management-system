import { handlers } from '@/auth'

// Public Auth.js endpoints validate credentials, signed sessions and CSRF tokens.
export const { GET, POST } = handlers
export const runtime = 'nodejs'
