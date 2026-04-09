import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { GoalNote, Mood, PaginatedGoalNotesResponse } from '../lib/types'

// ── List notes for a goal ────────────────────────────────────────────────────

export function useNotes(goalId: string) {
  return useQuery({
    queryKey: queryKeys.notes(goalId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedGoalNotesResponse>(
        `/goals/${goalId}/notes?limit=20&offset=0`,
      )
      return data
    },
    enabled: !!goalId,
  })
}

// ── Create a note ────────────────────────────────────────────────────────────

interface CreateNotePayload {
  goalId: string
  content: string
  mood: Mood | null
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ goalId, content, mood }: CreateNotePayload) => {
      const { data } = await api.post<GoalNote>(`/goals/${goalId}/notes`, { content, mood })
      return data
    },
    onSuccess: (_data, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(goalId) })
    },
  })
}

// ── Update a note ────────────────────────────────────────────────────────────

interface UpdateNotePayload {
  goalId: string
  noteId: string
  content?: string
  mood?: Mood | null
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ noteId, content, mood }: UpdateNotePayload) => {
      const { data } = await api.patch<GoalNote>(`/notes/${noteId}`, { content, mood })
      return data
    },
    onSuccess: (_data, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(goalId) })
    },
  })
}

// ── Delete a note ────────────────────────────────────────────────────────────

interface DeleteNotePayload {
  goalId: string
  noteId: string
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ noteId }: DeleteNotePayload) => {
      await api.delete(`/notes/${noteId}`)
    },
    onSuccess: (_data, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(goalId) })
    },
  })
}
