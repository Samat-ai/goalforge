/* GoalForge service worker — push notifications only, no fetch caching.
 *
 * Vite's content-hashed bundles are cached by the browser's normal HTTP cache.
 * Adding a cache-first SW fetch handler would serve stale JS/API responses
 * after deploys and break React Query's cache model. Do NOT add a fetch
 * listener here without a network-first strategy and API exclusion rules.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => caches.delete(k)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'GoalForge Reminder'
  const options = {
    body: data.body || 'You have pending tasks today.',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(target))
})
