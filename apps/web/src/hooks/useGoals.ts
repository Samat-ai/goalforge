import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { Goal, PaginatedGoalsResponse } from '../lib/types'

const PARAMS = { limit: 20, offset: 0 } as const
const GENERATING_POLL_MS = 5_000


function needsPolling(goals: Goal[]): boolean {
  return goals.some(g => g.milestones.some(m =>
    m.sprint_status === 'generating' ||
    (m.sprint_status === 'active' && !m.is_completed &&
     g.daily_tasks.filter(t => t.milestone_id === m.id).length === 0)
  ))
}

export function useGoalsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.goals(userId!, PARAMS),
    queryFn: async () => {
      const { data } = await api.get<PaginatedGoalsResponse>(
        `/users/${userId}/goals?limit=${PARAMS.limit}&offset=${PARAMS.offset}`,
      )
      return data
    },
    enabled: !!userId,
    refetchInterval: (query) => {
      const goals = query.state.data?.items ?? []
      return needsPolling(goals) ? GENERATING_POLL_MS : false
    },
  })

  return {
    goals: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
