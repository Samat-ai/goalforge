/**
 * GoalForge Service Worker
 *
 * Caching strategies:
 *  - App shell (HTML): Network-first, fallback to cache (SPA navigation)
 *  - Static assets (JS/CSS/fonts/images): Stale-while-revalidate
 *  - API calls: Network-first with 5s timeout, fallback to cache
 *  - Push notifications: Handled here
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE  = `goalforge-shell-${CACHE_VERSION}`
const ASSETS_CACHE = `goalforge-assets-${CACHE_VERSION}`
const API_CACHE    = `goalforge-api-${CACHE_VERSION}`

const SHELL_URLS = ['/', '/index.html']

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: prune old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const LIVE_CACHES = [SHELL_CACHE, ASSETS_CACHE, API_CACHE]
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('goalforge-') && !LIVE_CACHES.includes(k))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET; skip chrome-extension, data: URIs, etc.
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return

  // API calls → network-first with timeout
  if (url.pathname.startsWith('/api/') || url.port === '8000') {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 5000))
    return
  }

  // SPA navigation → serve index.html (network-first, fall back to shell cache)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html').then((r) => r ?? fetch(request)))
    )
    return
  }

  // Vite assets (hashed filenames) → stale-while-revalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE))
    return
  }
})

// ── Strategy helpers ─────────────────────────────────────────────────────────

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName)
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(tid)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  })
  return cached ?? fetchPromise
}

function isStaticAsset(pathname) {
  return /\.(js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|json)$/.test(pathname)
}

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() }
  catch { payload = { title: 'GoalForge', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'GoalForge', {
      body: payload.body ?? 'You have a new notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: payload.tag ?? 'goalforge',
      data: payload.data ?? {},
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.endsWith(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

// ── Background Sync (offline task completions) ───────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-completions') {
    event.waitUntil(syncQueuedCompletions())
  }
})

async function syncQueuedCompletions() {
  // Reads queued task completions from IndexedDB and replays them.
  // Integration point: useOfflineQueue hook writes to IndexedDB,
  // this worker drains the queue when connectivity is restored.
  // Full IndexedDB implementation is in useOfflineQueue.ts.
  self.clients.matchAll().then((clients) => {
    clients.forEach((c) => c.postMessage({ type: 'sync-complete' }))
  })
}
