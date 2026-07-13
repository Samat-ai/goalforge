/* GoalForge service worker — Cache-first / Network-first / SWR strategy.
 *
 * Fetch routing:
 *   /api/*          → network-only (never cache game state — prevents stale
 *                                   star points / task data in React Query)
 *   /assets/*       → stale-while-revalidate (Vite content-hashes these;
 *                     a cached entry is always correct when the URL hasn't changed)
 *   navigation      → network-first, fallback to cached shell (a cached
 *                     index.html must never outlive a deploy — it references
 *                     content-hashed bundles that no longer exist → blank page)
 *   everything else → network-first, fallback to cache
 *
 * Offline fallback: navigation requests that fail serve the cached '/' shell so
 * React can still mount and show a graceful offline state.
 *
 * To purge all caches on next deploy: bump CACHE_VERSION (e.g. 'v3').
 */

const CACHE_VERSION = 'v4'
const CACHE_NAME = `goalforge-shell-${CACHE_VERSION}`
const STATIC_CACHE = `goalforge-static-${CACHE_VERSION}`

const SHELL_URLS = ['/', '/manifest.json', '/icon.svg']

// ── Install: pre-cache the app shell ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// ── Activate: purge stale caches ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_NAME, STATIC_CACHE])
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'GoalForge Reminder'
  const options = {
    body: data.body || 'You have pending tasks today.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(target))
})

// ── Caching strategies ───────────────────────────────────────────────────────

/** Network-first: try network, fall back to cache. Navigation requests fall
 *  back to the cached shell ('/') so React can mount offline. */
async function networkFirst(request, cacheName = CACHE_NAME) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

/** Stale-while-revalidate: serve from cache immediately (if available) and
 *  update the cache entry in the background from the network. */
async function staleWhileRevalidate(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request)
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((cache) => cache.put(request, response.clone()))
    }
    return response
  }).catch(() => null)

  return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 })
}

// ── Fetch routing ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests; let cross-origin (fonts, CDN) pass through
  if (url.origin !== self.location.origin) return

  // 1. API calls: skip SW entirely — browser handles, React Query sees live data
  if (url.pathname.startsWith('/api/')) return

  // 2. Vite hashed assets: stale-while-revalidate
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE))
    return
  }

  // 3. App shell / navigation: network-first so a fresh deploy's index.html
  // always wins; falls back to the cached shell offline (networkFirst handles
  // the navigate-mode '/' fallback itself)
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, CACHE_NAME))
    return
  }

  // 4. Everything else (manifest, icons, sw assets): network-first
  event.respondWith(networkFirst(event.request, CACHE_NAME))
})
