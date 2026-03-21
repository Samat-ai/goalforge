import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

interface ProfileResponse {
  star_points: number
}

export function useProfileQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.profile(userId!),
    queryFn: async () => {
      const { data } = await api.get<ProfileResponse>(`/users/${userId}/profile`)
      return data
    },
    enabled: !!userId,
  })

  return {
    pts: query.data?.star_points ?? 0,
    isLoading: query.isLoading,
  }
}
