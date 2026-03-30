/* GoalForge service worker — App Shell + Network-First strategy.
 *
 * Fetch routing:
 *   /api/*          → network-only  (never cache game state — prevents stale
 *                                    star points / task data in React Query)
 *   /assets/*       → cache-first   (Vite content-hashes these filenames;
 *                                    a cached entry is always correct because
 *                                    if content changes, the URL changes too)
 *   navigation      → network-first, fallback to cached shell (/)
 *   everything else → network-first, fallback to cache
 *
 * To purge all caches on next deploy: bump CACHE_NAME to 'goalforge-shell-v2'.
 */

const CACHE_NAME = 'goalforge-shell-v1'
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon.svg']

// ── Install: pre-cache the app shell ─────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// ── Activate: purge stale caches ─────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Push notifications (unchanged from original) ─────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'GoalForge Reminder'
  const options = {
    body: data.body || 'You have pending tasks today.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(target))
})

// ── Fetch routing ─────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Navigation fallback: serve cached shell so React mounts
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests; let cross-origin (fonts, CDN) pass through
  if (url.origin !== self.location.origin) return

  // 1. API calls: skip SW entirely — browser handles, React Query sees failure
  if (url.pathname.startsWith('/api/')) return

  // 2. Vite hashed assets: cache-first (content-hash guarantees freshness)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  // 3. Everything else (shell, manifest, icon, navigation): network-first
  event.respondWith(networkFirst(event.request))
})
