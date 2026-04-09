import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type {
  CheckoutSessionResponse,
  PortalSessionResponse,
  Subscription,
} from '../lib/types'

/**
 * Fetch the current user's subscription plan and status.
 * Returns a synthetic free-tier record when no billing relationship exists yet.
 */
export function useSubscription(userId: string | undefined) {
  return useQuery<Subscription>({
    queryKey: queryKeys.subscription(userId!),
    queryFn: async () => {
      const { data } = await api.get<Subscription>(
        `/users/${userId}/billing/subscription`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Create a Stripe Checkout session and redirect the browser to Stripe.
 */
export function useCreateCheckout(userId: string | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CheckoutSessionResponse>(
        `/users/${userId}/billing/create-checkout-session`,
      )
      return data
    },
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.url
    },
    onError: () => {
      toast.error('Could not start checkout. Please try again.')
    },
    onSettled: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.subscription(userId) })
      }
    },
  })
}

/**
 * Create a Stripe Billing Portal session and redirect the browser to the portal.
 */
export function useCreatePortal(userId: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<PortalSessionResponse>(
        `/users/${userId}/billing/create-portal-session`,
      )
      return data
    },
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    },
    onError: () => {
      toast.error('Could not open billing portal. Please try again.')
    },
  })
}
