import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { Partner } from '../lib/types'

export function usePartnersQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.partners(userId!),
    queryFn: async () => {
      const { data } = await api.get<Partner[]>(`/users/${userId}/partners`)
      return data
    },
    enabled: !!userId,
  })

  return {
    partners: query.data ?? [],
    isLoading: query.isLoading,
  }
}

export function useInvitePartnerMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (partnerEmail: string) => {
      await api.post(`/users/${userId}/partners/invite`, { partner_email: partnerEmail })
    },
    onSuccess: () => {
      toast.success('Partner invite sent')
      qc.invalidateQueries({ queryKey: queryKeys.partners(userId) })
    },
    onError: () => {
      toast.error('Could not send partner invite')
    },
  })

  return {
    invitePartner: mutation.mutate,
    isInviting: mutation.isPending,
  }
}
