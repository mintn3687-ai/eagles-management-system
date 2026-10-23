const CACHE_PREFIX = 'eagles-drama-static-'
const BUILD_REVISION = new URL(self.location.href).searchParams.get('revision')
if (!BUILD_REVISION || !/^[a-f0-9]{40}$/i.test(BUILD_REVISION)) {
  throw new Error('Service worker requires a valid Vercel commit SHA revision')
}
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_REVISION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable_icon_x512.png',
  '/apple-touch-icon.png',
]
const FIXED_STATIC_PATHS = new Set(PRECACHE_URLS)
const SENSITIVE_PATHS = new Set(['/login', '/signin', '/sign-in', '/signup', '/sign-up', '/register'])
const AUTHENTICATED_PATHS = ['/member', '/admin']

function isWithinPath(pathname, basePath) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return
  if (SENSITIVE_PATHS.has(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        const offlinePage = await cache.match(OFFLINE_URL)
        return offlinePage || Response.error()
      }),
    )
    return
  }

  if (AUTHENTICATED_PATHS.some((basePath) => isWithinPath(url.pathname, basePath))) return

  const isNextStatic = url.pathname.startsWith('/_next/static/')
  if (!isNextStatic && !FIXED_STATIC_PATHS.has(url.pathname)) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request)
      if (cachedResponse) return cachedResponse

      const response = await fetch(request)
      const cacheControl = response.headers.get('cache-control') || ''
      if (
        isNextStatic &&
        response.ok &&
        response.type === 'basic' &&
        !response.headers.has('set-cookie') &&
        /(?:^|,)\s*public\b/i.test(cacheControl) &&
        /(?:^|,)\s*immutable\b/i.test(cacheControl)
      ) {
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})
