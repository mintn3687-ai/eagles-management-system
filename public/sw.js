const CACHE_NAME = 'eagles-drama-static-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]
const FIXED_STATIC_PATHS = new Set(PRECACHE_URLS)
const SENSITIVE_PATHS = new Set(['/login', '/signin', '/sign-in', '/signup', '/sign-up', '/register'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('eagles-drama-static-') && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    )),
  )
  self.clients.claim()
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
        const offlinePage = await caches.match(OFFLINE_URL)
        return offlinePage || Response.error()
      }),
    )
    return
  }

  const isNextStatic = url.pathname.startsWith('/_next/static/')
  if (!isNextStatic && !FIXED_STATIC_PATHS.has(url.pathname)) return

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
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
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})
