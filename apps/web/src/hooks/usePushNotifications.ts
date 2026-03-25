import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { PushSubscriptionRecord } from '../lib/types'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)))
}

export function usePushSubscriptionsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.pushSubscriptions(userId!),
    queryFn: async () => {
      const { data } = await api.get<PushSubscriptionRecord[]>(`/users/${userId}/push-subscriptions`)
      return data
    },
    enabled: !!userId,
  })

  return {
    subscriptions: query.data ?? [],
    isLoading: query.isLoading,
  }
}

export function useEnablePushMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push not supported in this browser')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        if (!vapidPublicKey) {
          throw new Error('Missing VITE_VAPID_PUBLIC_KEY')
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        })
      }

      const json = subscription.toJSON()
      await api.post(`/users/${userId}/push-subscriptions`, {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      })
    },
    onSuccess: () => {
      toast.success('Browser notifications enabled')
      qc.invalidateQueries({ queryKey: queryKeys.pushSubscriptions(userId) })
    },
    onError: () => {
      toast.error('Could not enable browser notifications')
    },
  })

  return {
    enablePush: mutation.mutate,
    isEnabling: mutation.isPending,
  }
}
