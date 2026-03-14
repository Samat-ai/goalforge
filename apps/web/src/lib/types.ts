// Shared data interfaces used across Dashboard and its sub-components

export interface Task {
  id: string
  goal_id: string
  milestone_id: string | null
  description: string
  tip: string
  assigned_date: string
  is_completed: boolean
  completed_at: string | null
}

export interface Milestone {
  id: string
  goal_id: string
  title: string
  position: number
  is_final: boolean
  sprint_theme: string
  sprint_status: 'pending' | 'generating' | 'ready' | 'active' | 'completed' | 'failed'
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  raw_input: string
  smart_title: string
  smart_description: string
  goal_type: string
  target_date: string
  milestones: Milestone[]
  milestones_completed: number
  milestones_total: number
  status: 'active' | 'achieved' | 'abandoned'
  current_streak: number
  best_streak: number
  vitality: number
  progress: number
  created_at: string
  daily_tasks: Task[]
  completed_days: string[]
}
