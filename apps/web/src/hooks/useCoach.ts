import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { CoachSendMessageResponse, CoachSession } from '../lib/types'

export function useCoachSessionQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.coachSession(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<CoachSession | null>(`/users/${userId}/coach/sessions/active`)
      return data
    },
    enabled: !!userId,
  })

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useStartCoachSessionMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CoachSession>(`/users/${userId}/coach/sessions/start`)
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.coachSession(userId), data)
    },
  })

  return {
    start: mutation.mutateAsync,
    isStarting: mutation.isPending,
  }
}

export function useSendCoachMessageMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const { data } = await api.post<CoachSendMessageResponse>(`/coach/sessions/${sessionId}/messages`, { content })
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.coachSession(userId), data.session)
      if (data.forged_goal) {
        qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })
      }
    },
  })

  return {
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
    result: mutation.data,
  }
}
