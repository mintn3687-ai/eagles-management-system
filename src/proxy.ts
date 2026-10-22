import NextAuth from 'next-auth'
import type { NextAuthRequest } from 'next-auth'
import type { NextFetchEvent, NextMiddleware } from 'next/server'
import { NextResponse } from 'next/server'
import authConfig from './auth.config'

export const proxy: NextMiddleware = NextAuth(authConfig).auth(
  (_request: NextAuthRequest, _event: NextFetchEvent) => NextResponse.next(),
)
export const config = { matcher: ['/member/:path*', '/admin/:path*'] }
