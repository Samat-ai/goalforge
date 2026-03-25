import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { ShopReward, ShopRewardRedeemResponse } from '../lib/types'

export function useShopRewardsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.shopRewards(userId!),
    queryFn: async () => {
      const { data } = await api.get<ShopReward[]>(`/users/${userId}/shop-rewards`)
      return data
    },
    enabled: !!userId,
  })

  return {
    rewards: query.data ?? [],
    isLoading: query.isLoading,
  }
}

export function useShopRewardMutations(userId: string) {
  const qc = useQueryClient()

  const createReward = useMutation({
    mutationFn: async (payload: { title: string; cost: number }) => {
      await api.post(`/users/${userId}/shop-rewards`, payload)
    },
    onSuccess: () => {
      toast.success('Reward added to your shop')
      qc.invalidateQueries({ queryKey: queryKeys.shopRewards(userId) })
    },
    onError: () => toast.error('Could not create reward.'),
  })

  const redeemReward = useMutation({
    mutationFn: async (rewardId: string) => {
      const { data } = await api.post<ShopRewardRedeemResponse>(`/shop-rewards/${rewardId}/redeem`)
      return data
    },
    onSuccess: (data) => {
      toast.success(`Redeemed: ${data.reward.title}`)
      qc.invalidateQueries({ queryKey: queryKeys.shopRewards(userId) })
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })
    },
    onError: () => toast.error('Not enough stars or reward unavailable.'),
  })

  return {
    addReward: createReward.mutate,
    redeemReward: redeemReward.mutate,
    isCreating: createReward.isPending,
    isRedeeming: redeemReward.isPending,
  }
}
