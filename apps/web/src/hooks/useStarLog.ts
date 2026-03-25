import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { StarLogResponse } from '../lib/types'

export function useStarLogQuery(userId: string | undefined, days = 7) {
  return useQuery<StarLogResponse>({
    queryKey: queryKeys.starLog(userId ?? '', days),
    enabled: !!userId,
    queryFn: async () => {
      const res = await api.get<StarLogResponse>(`/users/${userId}/star-log?days=${days}`)
      return res.data
    },
  })
}
