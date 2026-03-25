import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { EnergyResizeResponse, Task } from '../lib/types'

export function useEnergyResizeMutation(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<EnergyResizeResponse> => {
      const { data } = await api.post<EnergyResizeResponse>(
        `/users/${userId}/energy-resize`,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
    },
    onError: () => {
      toast.error('Could not resize tasks. Please try again.')
    },
  })
}

export function useTaskRestoreMutation(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string): Promise<Task> => {
      const { data } = await api.post<Task>(`/tasks/${taskId}/restore`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
    },
    onError: () => {
      toast.error('Could not restore task. Please try again.')
    },
  })
}
