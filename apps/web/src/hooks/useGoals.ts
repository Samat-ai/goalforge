import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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

export function useGoalsQuery(userId: string | undefined, includeArchived = false) {
  const query = useQuery({
    queryKey: queryKeys.goals(userId!, PARAMS),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PARAMS.limit),
        offset: String(PARAMS.offset),
        include_archived: String(includeArchived),
      })
      const { data } = await api.get<PaginatedGoalsResponse>(
        `/users/${userId}/goals?${params}`,
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

export function useArchiveGoal(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (goalId: string) => {
      const { data } = await api.post<Goal>(`/goals/${goalId}/archive`)
      return data
    },
    onSuccess: (data, goalId) => {
      qc.setQueryData<PaginatedGoalsResponse>(queryKeys.goals(userId, PARAMS), old =>
        old ? { ...old, items: old.items.map(g => g.id === goalId ? data : g) } : old,
      )
      toast.success('Goal archived')
    },
    onError: () => {
      toast.error('Could not archive goal. Please try again.')
    },
  })
}

export function useUnarchiveGoal(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (goalId: string) => {
      const { data } = await api.post<Goal>(`/goals/${goalId}/unarchive`)
      return data
    },
    onSuccess: (data, goalId) => {
      qc.setQueryData<PaginatedGoalsResponse>(queryKeys.goals(userId, PARAMS), old =>
        old ? { ...old, items: old.items.map(g => g.id === goalId ? data : g) } : old,
      )
      toast.success('Goal unarchived')
    },
    onError: () => {
      toast.error('Could not unarchive goal. Please try again.')
    },
  })
}
