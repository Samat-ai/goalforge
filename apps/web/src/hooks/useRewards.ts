import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { Reward } from '../lib/types'

export const rewardsKey = (userId: string) => ['rewards', userId] as const

export function useRewardsQuery(userId: string) {
  return useQuery<Reward[]>({
    queryKey: rewardsKey(userId),
    queryFn: async () => {
      const { data } = await api.get<Reward[]>(`/users/${userId}/rewards`)
      return data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useEquipRewardMutation(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (rewardId: string): Promise<Reward> => {
      const { data } = await api.patch<Reward>(`/rewards/${rewardId}/equip`)
      return data
    },
    onMutate: async (rewardId: string) => {
      // Optimistic update: set this reward as equipped, unset others of same type
      await qc.cancelQueries({ queryKey: rewardsKey(userId) })
      const prev = qc.getQueryData<Reward[]>(rewardsKey(userId))

      qc.setQueryData<Reward[]>(rewardsKey(userId), old => {
        if (!old) return old
        const target = old.find(r => r.id === rewardId)
        if (!target) return old
        return old.map(r => ({
          ...r,
          is_equipped: r.id === rewardId
            ? true
            : r.reward_type === target.reward_type
              ? false
              : r.is_equipped,
        }))
      })

      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev !== undefined) qc.setQueryData(rewardsKey(userId), context.prev)
      toast.error('Could not equip reward. Please try again.')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rewardsKey(userId) })
    },
  })
}
