import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { CoachSendMessageResponse, CoachSession, PaginatedCoachSessions } from '../lib/types'

export function useCoachSessionsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.coachSessions(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<PaginatedCoachSessions>(`/users/${userId}/coach/sessions?limit=50&offset=0`)
      return data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
  return {
    sessions: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useCoachSessionQuery(userId: string | undefined, sessionId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.coachSession(sessionId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<CoachSession>(`/coach/sessions/${sessionId}`)
      return data
    },
    enabled: !!userId && !!sessionId,
    staleTime: 60_000,
  })
  return {
    session: query.data ?? null,
    isLoading: !!sessionId && query.isLoading,
  }
}

export function useCreateCoachSessionMutation(userId: string) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CoachSession>(`/users/${userId}/coach/sessions`)
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.coachSession(data.id), data)
      qc.invalidateQueries({ queryKey: queryKeys.coachSessions(userId) })
    },
  })
  return { create: mutation.mutateAsync, isCreating: mutation.isPending }
}

export function useSendCoachMessageMutation(userId: string) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const { data } = await api.post<CoachSendMessageResponse>(`/coach/sessions/${sessionId}/messages`, { content })
      return data
    },
    onMutate: async ({ sessionId, content }) => {
      await qc.cancelQueries({ queryKey: queryKeys.coachSession(sessionId) })
      const previous = qc.getQueryData<CoachSession>(queryKeys.coachSession(sessionId))
      if (previous) {
        qc.setQueryData<CoachSession>(queryKeys.coachSession(sessionId), {
          ...previous,
          messages: [
            ...previous.messages,
            {
              id: `optimistic-${Date.now()}`,
              session_id: previous.id,
              role: 'user',
              content,
              chips: null,
              forged_goal_id: null,
              created_at: new Date().toISOString(),
            },
          ],
        })
      }
      return { previous, sessionId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKeys.coachSession(ctx.sessionId), ctx.previous)
    },
    onSuccess: (data, { sessionId }) => {
      qc.setQueryData(queryKeys.coachSession(sessionId), data.session)
      // Ordering + titles in the rail; goals because edit turns are invisible
      // to the client — always refresh. Chat never calls useGoalMutations:
      // Dashboard stays the authoritative goal-cache owner.
      qc.invalidateQueries({ queryKey: queryKeys.coachSessions(userId) })
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
      if (data.forged_goal) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })
      }
    },
  })
  return { send: mutation.mutateAsync, isSending: mutation.isPending, result: mutation.data }
}

export function useDeleteCoachSessionMutation(userId: string) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/coach/sessions/${sessionId}`)
    },
    onSuccess: (_data, sessionId) => {
      qc.removeQueries({ queryKey: queryKeys.coachSession(sessionId) })
      qc.invalidateQueries({ queryKey: queryKeys.coachSessions(userId) })
    },
  })
  return { remove: mutation.mutateAsync, isDeleting: mutation.isPending }
}
