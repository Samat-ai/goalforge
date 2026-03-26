import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { AccountabilityOverview } from '../lib/types'

export function useAccountabilityQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.accountability(userId!),
    queryFn: async () => {
      const { data } = await api.get<AccountabilityOverview>(`/users/${userId}/accountability-invites`)
      return data
    },
    enabled: !!userId,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useAccountabilityMutations(userId: string) {
  const qc = useQueryClient()

  const sendInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      await api.post(`/users/${userId}/accountability-invites`, { email })
    },
    onSuccess: () => {
      toast.success('Invite sent or pending')
      qc.invalidateQueries({ queryKey: queryKeys.accountability(userId) })
    },
    onError: () => {
      toast.error('Could not send invite. Please try again.')
    },
  })

  const acceptInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await api.post(`/accountability-invites/${inviteId}/accept`)
    },
    onSuccess: () => {
      toast.success('Invite accepted')
      qc.invalidateQueries({ queryKey: queryKeys.accountability(userId) })
    },
    onError: () => {
      toast.error('Could not accept invite.')
    },
  })

  const declineInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await api.post(`/accountability-invites/${inviteId}/decline`)
    },
    onSuccess: () => {
      toast.success('Invite declined')
      qc.invalidateQueries({ queryKey: queryKeys.accountability(userId) })
    },
    onError: () => {
      toast.error('Could not decline invite.')
    },
  })

  return {
    sendInvite: sendInviteMutation.mutate,
    acceptInvite: acceptInviteMutation.mutate,
    declineInvite: declineInviteMutation.mutate,
    isSendingInvite: sendInviteMutation.isPending,
    isAcceptingInvite: acceptInviteMutation.isPending,
    isDecliningInvite: declineInviteMutation.isPending,
  }
}
