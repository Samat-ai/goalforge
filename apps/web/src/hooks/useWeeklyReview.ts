import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { WeeklyReviewResponse } from '../lib/types'

export function useWeeklyReviewQuery(userId: string | undefined, days = 7) {
  return useQuery<WeeklyReviewResponse>({
    queryKey: queryKeys.weeklyReview(userId ?? '', days),
    enabled: !!userId,
    queryFn: async () => {
      const res = await api.get<WeeklyReviewResponse>(`/users/${userId}/weekly-review?days=${days}`)
      return res.data
    },
  })
}
