import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { todayStr } from '../lib/gamification'
import { triggerCelebration } from '../lib/celebrations'
import type { Goal, Task, PaginatedGoalsResponse } from '../lib/types'

const GOALS_PARAMS = { limit: 20, offset: 0 } as const

interface ProfileData {
  star_points: number
}

export function useGoalMutations(userId: string) {
  const qc = useQueryClient()
  const goalsKey = queryKeys.goals(userId, GOALS_PARAMS)
  const profileKey = queryKeys.profile(userId)

  function updateGoals(updater: (goals: Goal[]) => Goal[]) {
    qc.setQueryData<PaginatedGoalsResponse>(goalsKey, old =>
      old ? { ...old, items: updater(old.items) } : old,
    )
  }

  function updatePts(delta: number) {
    qc.setQueryData<ProfileData>(profileKey, old =>
      old ? { ...old, star_points: old.star_points + delta } : old,
    )
  }

  // ── Add Goal ──
  const addGoalMutation = useMutation({
    mutationFn: async (rawInput: string) => {
      const { data } = await api.post<Goal>(`/users/${userId}/goals`, { raw_input: rawInput })
      return data
    },
    onSuccess: (data) => {
      updateGoals(goals => [data, ...goals])
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
    },
  })

  // ── Complete Task (optimistic fire-and-forget) ──
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.patch(`/tasks/${taskId}/complete`)
    },
    onMutate: async (taskId: string) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)
      const prevProfile = qc.getQueryData<ProfileData>(profileKey)
      const today = todayStr()

      updateGoals(goals => goals.map(goal => {
        if (!goal.daily_tasks.some(t => t.id === taskId)) return goal
        return {
          ...goal,
          daily_tasks: goal.daily_tasks.map(t => t.id === taskId ? { ...t, is_completed: true } : t),
          completed_days: goal.completed_days.includes(today) ? goal.completed_days : [...goal.completed_days, today],
        }
      }))
      updatePts(10)
      toast.success('Task completed! +10 pts', { icon: '⚡' })
      triggerCelebration('task')

      return { prevGoals, prevProfile }
    },
    onError: (_err, _taskId, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      if (context?.prevProfile) qc.setQueryData(profileKey, context.prevProfile)
      toast.error('Could not save task. Please try again.')
    },
  })

  // ── Save Edit (optimistic with rollback) ──
  const saveEditMutation = useMutation({
    mutationFn: async ({ taskId, description }: { taskId: string; description: string }) => {
      await api.patch(`/tasks/${taskId}`, { description })
    },
    onMutate: async ({ taskId, description }) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)

      updateGoals(goals => goals.map(g => ({
        ...g,
        daily_tasks: g.daily_tasks.map(t => t.id === taskId ? { ...t, description } : t),
      })))

      return { prevGoals }
    },
    onSuccess: () => {
      toast.success('Task updated')
    },
    onError: (_err, _vars, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      toast.error('Could not update task.')
    },
  })

  // ── Delete Goal (optimistic with rollback) ──
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      await api.delete(`/goals/${goalId}`)
    },
    onMutate: async (goalId: string) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)

      updateGoals(goals => goals.filter(g => g.id !== goalId))

      return { prevGoals }
    },
    onSuccess: () => {
      toast.success('Goal deleted')
    },
    onError: (_err, _goalId, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      toast.error('Could not delete goal.')
    },
  })

  // ── Complete Milestone (server-replace) ──
  const completeMilestoneMutation = useMutation({
    mutationFn: async ({ goalId, milestoneId }: { goalId: string; milestoneId: string }) => {
      const { data } = await api.post<Goal>(`/goals/${goalId}/milestones/${milestoneId}/complete`)
      return data
    },
    onSuccess: (data, { goalId }) => {
      updateGoals(goals => goals.map(g => g.id === goalId ? data : g))
      toast.success('Sprint complete! Next sprint unlocked. ✦')
      triggerCelebration('sprint')
    },
    onError: () => {
      toast.error('Could not complete sprint. Please try again.')
    },
  })

  // ── Change Status (optimistic with rollback) ──
  const changeStatusMutation = useMutation({
    mutationFn: async ({ goalId, newStatus }: { goalId: string; newStatus: Goal['status'] }) => {
      await api.patch(`/goals/${goalId}`, { status: newStatus })
    },
    onMutate: async ({ goalId, newStatus }) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)
      const prevProfile = qc.getQueryData<ProfileData>(profileKey)
      const prevStatus = prevGoals?.items.find(g => g.id === goalId)?.status

      updateGoals(goals => goals.map(g => g.id === goalId ? { ...g, status: newStatus } : g))

      if (newStatus === 'achieved' && prevStatus !== 'achieved') {
        updatePts(100)
        toast.success('Goal achieved! +100 pts 🏆')
        triggerCelebration('goal')
      }

      return { prevGoals, prevProfile, prevStatus }
    },
    onError: (_err, _vars, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      if (context?.prevProfile) qc.setQueryData(profileKey, context.prevProfile)
      toast.error('Could not update goal status.')
    },
  })

  // ── Add Task (await server response) ──
  const addTaskMutation = useMutation({
    mutationFn: async ({ goalId, milestoneId, description }: { goalId: string; milestoneId: string | null; description: string }) => {
      const { data } = await api.post<Task>(`/goals/${goalId}/tasks`, {
        description,
        milestone_id: milestoneId,
        assigned_date: todayStr(),
      })
      return { goalId, task: data }
    },
    onSuccess: ({ goalId, task }) => {
      updateGoals(goals => goals.map(g =>
        g.id === goalId ? { ...g, daily_tasks: [...g.daily_tasks, task] } : g,
      ))
      toast.success('Task added')
    },
    onError: () => {
      toast.error('Could not add task.')
    },
  })

  // ── Regenerate Task (await server response) ──
  const regenerateTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data } = await api.post<Task>(`/tasks/${taskId}/regenerate`)
      return data
    },
    onSuccess: (data) => {
      updateGoals(goals => goals.map(g => ({
        ...g,
        daily_tasks: g.daily_tasks.map(t => t.id === data.id ? data : t),
      })))
      toast.success('Task regenerated')
    },
    onError: () => {
      toast.error('Could not regenerate task. Please try again.')
    },
  })

  // ── Reorder Tasks (optimistic fire-and-forget) ──
  const reorderTasksMutation = useMutation({
    mutationFn: async ({ goalId, taskPositions }: { goalId: string; taskPositions: { id: string; position: number }[] }) => {
      await api.put(`/goals/${goalId}/tasks/reorder`, { tasks: taskPositions })
    },
    onMutate: async ({ goalId, taskPositions }) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)
      const posMap = new Map(taskPositions.map(t => [t.id, t.position]))

      updateGoals(goals => goals.map(g => {
        if (g.id !== goalId) return g
        return {
          ...g,
          daily_tasks: g.daily_tasks.map(t => {
            const newPos = posMap.get(t.id)
            return newPos !== undefined ? { ...t, position: newPos } : t
          }),
        }
      }))

      return { prevGoals }
    },
    onError: (_err, _vars, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      toast.error('Could not reorder tasks.')
    },
  })

  // ── Retry Sprint Generation (server-replace) ──
  const retrySprintGenerationMutation = useMutation({
    mutationFn: async ({ goalId, milestoneId }: { goalId: string; milestoneId: string }) => {
      const { data } = await api.post<Goal>(
        `/goals/${goalId}/milestones/${milestoneId}/retry-generation`,
      )
      return data
    },
    onSuccess: (data, { goalId }) => {
      updateGoals(goals => goals.map(g => g.id === goalId ? data : g))
      toast.success('Sprint tasks generated successfully')
    },
    onError: () => {
      toast.error('Could not generate sprint tasks. Please try again.')
    },
  })

  // ── Return handlers matching existing Dashboard signatures ──
  return {
    addGoal: async (rawInput: string): Promise<void> => { await addGoalMutation.mutateAsync(rawInput) },
    isAddingGoal: addGoalMutation.isPending,

    completeTask: (taskId: string) => { completeTaskMutation.mutate(taskId) },

    saveEdit: (taskId: string, description: string) =>
      saveEditMutation.mutateAsync({ taskId, description }),

    deleteGoal: (goalId: string) => { deleteGoalMutation.mutate(goalId) },

    completeMilestone: async (goalId: string, milestoneId: string): Promise<void> => {
      await completeMilestoneMutation.mutateAsync({ goalId, milestoneId })
    },

    changeStatus: (goalId: string, newStatus: Goal['status']) => {
      changeStatusMutation.mutate({ goalId, newStatus })
    },

    addTask: async (goalId: string, milestoneId: string | null, description: string): Promise<void> => {
      await addTaskMutation.mutateAsync({ goalId, milestoneId, description })
    },

    regenerateTask: async (taskId: string): Promise<void> => {
      await regenerateTaskMutation.mutateAsync(taskId)
    },

    reorderTasks: (goalId: string, taskPositions: { id: string; position: number }[]) => {
      reorderTasksMutation.mutate({ goalId, taskPositions })
    },

    retrySprintGeneration: async (goalId: string, milestoneId: string): Promise<void> => {
      await retrySprintGenerationMutation.mutateAsync({ goalId, milestoneId })
    },
    isRetryingSprintGeneration: retrySprintGenerationMutation.isPending,
  }
}
