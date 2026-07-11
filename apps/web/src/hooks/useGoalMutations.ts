import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { todayStr } from '../lib/gamification'
import { triggerCelebration, triggerCritCelebration, triggerJackpotCelebration } from '../lib/celebrations'
import type { Goal, Task, PaginatedGoalsResponse, TaskCompleteResponse, RewardDrop } from '../lib/types'

const GOALS_PARAMS = { limit: 20, offset: 0 } as const

interface ProfileData {
  star_points: number
}

export function useGoalMutations(userId: string, onJackpot?: (drop: RewardDrop) => void) {
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

  // ── Complete Task (mutateAsync internally; toast deferred to onSuccess) ──
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string): Promise<TaskCompleteResponse> => {
      const { data } = await api.patch<TaskCompleteResponse>(`/tasks/${taskId}/complete`)
      return data
    },
    onMutate: async (taskId: string) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const prevGoals = qc.getQueryData<PaginatedGoalsResponse>(goalsKey)
      const prevProfile = qc.getQueryData<ProfileData>(profileKey)
      const today = todayStr()

      // Optimistic: mark complete + completed_at timestamp + +10 pts + confetti pop
      const completedAt = new Date().toISOString()
      updateGoals(goals => goals.map(goal => {
        if (!goal.daily_tasks.some(t => t.id === taskId)) return goal
        return {
          ...goal,
          daily_tasks: goal.daily_tasks.map(t =>
            t.id === taskId ? { ...t, is_completed: true, completed_at: completedAt } : t,
          ),
          completed_days: goal.completed_days.includes(today) ? goal.completed_days : [...goal.completed_days, today],
        }
      }))
      updatePts(10)
      triggerCelebration('task')
      // Toast is NOT fired here — deferred to onSuccess to avoid double-toast

      return { prevGoals, prevProfile }
    },
    onSuccess: (data) => {
      const drop = data.reward_drop
      // Correct the optimistic +10 to actual points awarded (0 for user-added tasks)
      updatePts(data.points_awarded - 10)

      if (!drop) {
        if (data.points_awarded === 0) {
          toast.success('Task tracked!', { icon: '✓' })
        } else {
          toast.success('Task completed! +10 pts', { icon: '⚡' })
        }
      } else if (drop.tier === 'bonus') {
        toast.success(`Bonus! +${drop.points_awarded} pts \u2746`, {
          style: { borderLeft: '3px solid #f59e0b', background: '#1a140a' },
        })
      } else if (drop.tier === 'crit') {
        triggerCritCelebration()
        toast.success(
          `CRIT \u2014 ${drop.collectible_display_name ?? 'Lore Fragment'} unlocked (+${drop.points_awarded} \u2b50)`,
          {
            duration: 10000,
            style: {
              borderLeft: '3px solid #a78bfa',
              background: 'linear-gradient(135deg, #1a0f2e, #0f1a2e)',
              color: '#e2e8f0',
            },
          }
        )
      } else if (drop.tier === 'jackpot') {
        triggerJackpotCelebration()
        onJackpot?.(drop)
      }
      qc.invalidateQueries({ queryKey: queryKeys.badges(userId) })
    },
    onError: (_err, _taskId, context) => {
      if (context?.prevGoals) qc.setQueryData(goalsKey, context.prevGoals)
      if (context?.prevProfile) qc.setQueryData(profileKey, context.prevProfile)
      toast.error('Could not save task. Please try again.')
    },
    onSettled: () => {
      // Always re-sync with server so local state stays consistent
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
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
    onSettled: (_data, _err, { newStatus }) => {
      // Backend awards +100 only once per goal (achievement_reward_granted);
      // re-sync so a re-achieve doesn't keep the optimistic +100 it never earned.
      if (newStatus === 'achieved') {
        qc.invalidateQueries({ queryKey: profileKey })
      }
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

  // ── Trigger Rescue Sprint (invalidate + re-fetch) ──
  const triggerRescueMutation = useMutation({
    mutationFn: (goalId: string) =>
      api.post(`/goals/${goalId}/rescue`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.goals(userId) })
    },
    onError: () => {
      toast.error('Could not start Easy Mode. Please try again.')
    },
  })

  // ── Return handlers matching existing Dashboard signatures ──
  return {
    addGoal: async (rawInput: string): Promise<void> => { await addGoalMutation.mutateAsync(rawInput) },
    isAddingGoal: addGoalMutation.isPending,

    completeTask: (taskId: string) => {
      completeTaskMutation.mutateAsync(taskId).catch(() => {
        // onError already handles rollback — suppress unhandled rejection
      })
    },

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

    triggerRescue: (goalId: string) => triggerRescueMutation.mutateAsync(goalId),
    isTriggeringRescue: triggerRescueMutation.isPending,
  }
}
