import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { Badge } from '../lib/types'

export function useBadgesQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.badges(userId!),
    queryFn: async () => {
      const { data } = await api.get<Badge[]>(`/users/${userId}/badges`)
      return data
    },
    enabled: !!userId,
  })

  return {
    badges: query.data ?? [],
    isLoading: query.isLoading,
  }
}
