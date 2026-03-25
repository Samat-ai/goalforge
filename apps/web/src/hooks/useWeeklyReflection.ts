import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { WeeklyReflection } from '../lib/types'

export function useLatestWeeklyReflectionQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.weeklyReflectionLatest(userId!),
    queryFn: async () => {
      const { data } = await api.get<WeeklyReflection>(`/users/${userId}/weekly-reflection/latest`)
      return data
    },
    enabled: !!userId,
    retry: false,
  })

  return {
    reflection: query.data,
    isLoading: query.isLoading,
    isNotFound: query.isError,
  }
}

export function useCreateWeeklyReflectionMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (payload: { went_well: string; blockers: string; week_rating: number }) => {
      const { data } = await api.post<WeeklyReflection>(`/users/${userId}/weekly-reflection`, payload)
      return data
    },
    onSuccess: data => {
      qc.setQueryData(queryKeys.weeklyReflectionLatest(userId), data)
      toast.success('Weekly reflection saved')
    },
    onError: () => {
      toast.error('Could not save weekly reflection')
    },
  })

  return {
    createReflection: mutation.mutate,
    isSaving: mutation.isPending,
  }
}
