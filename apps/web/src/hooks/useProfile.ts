import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { UserProfile } from '../lib/types'

export function useProfileQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.profile(userId!),
    queryFn: async () => {
      const { data } = await api.get<UserProfile>(`/users/${userId}/profile`)
      return data
    },
    enabled: !!userId,
  })

  return {
    pts: query.data?.star_points ?? 0,
    isLoading: query.isLoading,
    data: query.data,
  }
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: userId ? queryKeys.profile(userId) : ['profile'],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await api.get<UserProfile>(`/users/${userId}/profile`)
      return data
    },
    enabled: !!userId,
  })
}
