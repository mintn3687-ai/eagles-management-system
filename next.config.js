/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Next.js tracing scoped to this app when a parent folder has its own lockfile.
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  async headers() {
    const development = process.env.NODE_ENV !== 'production'
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
      "connect-src 'self'",
      ...(development ? [] : ['upgrade-insecure-requests']),
    ].join('; ')
    const headers = [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      ...(!development ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
    ]
    return [
      { source: '/:path*', headers },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          ...(process.env.VERCEL_GIT_COMMIT_SHA
            ? [{ key: 'X-PWA-Build-Revision', value: process.env.VERCEL_GIT_COMMIT_SHA }]
            : []),
        ],
      },
    ]
  },
}
export default nextConfig
