import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  total_tasks_completed: number
  total_goals_created: number
  total_goals_achieved: number
  current_streak_days: number
  longest_streak_days: number
  average_tasks_per_day: number
  most_active_hour: number
  active_days_last_30: number
}

export interface HeatmapDay {
  date: string
  count: number
  goals_active: number
}

export interface HeatmapResponse {
  data: HeatmapDay[]
  max_count: number
}

export interface StreakPeriod {
  start_date: string
  end_date: string
  length: number
}

export interface StreakHistory {
  current_streak: number
  longest_streak: number
  streak_history: StreakPeriod[]
}

export interface GoalMetrics {
  goal_id: string
  smart_title: string
  goal_type: string
  status: string
  tasks_completed: number
  tasks_total: number
  completion_rate: number
  days_active: number
  milestones_completed: number
  milestones_total: number
}

export interface GoalPerformance {
  goals: GoalMetrics[]
}

export interface HourlyCount {
  hour: number
  count: number
}

export interface ActivityByHour {
  hourly: HourlyCount[]
  peak_hour: number
}

export interface WeekVelocity {
  week_start: string
  tasks_completed: number
  week_number: number
}

export interface VelocityResponse {
  weeks: WeekVelocity[]
  trend: 'improving' | 'declining' | 'stable'
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

const analyticsKeys = {
  overview: (userId: string) => ['analytics', 'overview', userId] as const,
  heatmap: (userId: string, days: number) => ['analytics', 'heatmap', userId, days] as const,
  streakHistory: (userId: string) => ['analytics', 'streak-history', userId] as const,
  goalPerformance: (userId: string) => ['analytics', 'goal-performance', userId] as const,
  activityByHour: (userId: string) => ['analytics', 'activity-by-hour', userId] as const,
  velocity: (userId: string) => ['analytics', 'velocity', userId] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAnalyticsOverview(userId: string | undefined) {
  const query = useQuery({
    queryKey: analyticsKeys.overview(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<AnalyticsOverview>(
        `/users/${userId}/analytics/overview`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useCompletionHeatmap(userId: string | undefined, days = 90) {
  const query = useQuery({
    queryKey: analyticsKeys.heatmap(userId ?? '', days),
    queryFn: async () => {
      const { data } = await api.get<HeatmapResponse>(
        `/users/${userId}/analytics/completion-heatmap?days=${days}`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    heatmap: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useStreakHistory(userId: string | undefined) {
  const query = useQuery({
    queryKey: analyticsKeys.streakHistory(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<StreakHistory>(
        `/users/${userId}/analytics/streak-history`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    streakHistory: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useGoalPerformance(userId: string | undefined) {
  const query = useQuery({
    queryKey: analyticsKeys.goalPerformance(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<GoalPerformance>(
        `/users/${userId}/analytics/goal-performance`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    goalPerformance: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useActivityByHour(userId: string | undefined) {
  const query = useQuery({
    queryKey: analyticsKeys.activityByHour(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<ActivityByHour>(
        `/users/${userId}/analytics/activity-by-hour`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    activityByHour: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useVelocity(userId: string | undefined) {
  const query = useQuery({
    queryKey: analyticsKeys.velocity(userId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<VelocityResponse>(
        `/users/${userId}/analytics/velocity`,
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    velocity: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
