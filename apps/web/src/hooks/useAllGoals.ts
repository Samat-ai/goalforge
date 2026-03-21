import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { PaginatedGoalsResponse } from '../lib/types'

const PARAMS = { limit: 100, offset: 0 } as const

export function useAllGoalsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.goals(userId!, PARAMS),
    queryFn: async () => {
      const { data } = await api.get<PaginatedGoalsResponse>(
        `/users/${userId}/goals?limit=${PARAMS.limit}&offset=${PARAMS.offset}`,
      )
      return data
    },
    enabled: !!userId,
  })

  return {
    goals: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
