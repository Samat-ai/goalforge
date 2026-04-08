/**
 * Queue task completions while offline and register background sync.
 * When connectivity is restored, the service worker drains the queue
 * and replays completions against the API.
 */
import { useEffect } from 'react'

const DB_NAME = 'goalforge-offline'
const STORE   = 'pending-completions'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueCompletion(taskId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).add({ taskId, queuedAt: Date.now() })
  // Register background sync so the SW picks it up when online
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready
    await (reg as any).sync.register('sync-completions')
  }
}

export function useOfflineQueue() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'sync-complete') {
        // SW finished syncing — optionally trigger a query refetch here
        window.dispatchEvent(new CustomEvent('offline-sync-complete'))
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [])

  return { queueCompletion }
}
