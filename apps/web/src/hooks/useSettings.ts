import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { UserSettings, UserSettingsUpdatePayload } from '../lib/types'

export function useSettingsQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.settings(userId!),
    queryFn: async () => {
      const { data } = await api.get<UserSettings>(`/users/${userId}/settings`)
      return data
    },
    enabled: !!userId,
  })

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useSaveSettingsMutation(userId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (payload: UserSettingsUpdatePayload) => {
      await api.patch(`/users/${userId}/settings`, payload)
    },
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: queryKeys.settings(userId) })
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })
    },
    onError: () => {
      toast.error('Could not save settings. Please try again.')
    },
  })

  return {
    save: mutation.mutate,
    isSaving: mutation.isPending,
  }
}
