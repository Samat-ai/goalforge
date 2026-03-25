// Shared data interfaces used across Dashboard and its sub-components

export interface PaginatedGoalsResponse {
  items: Goal[]
  total: number
  limit: number
  offset: number
}

export interface UserSettings {
  id: string
  email: string
  star_points: number
  timezone: string
  display_name: string | null
}

export interface WeeklyReflection {
  id: string
  user_id: string
  went_well: string
  blockers: string
  week_rating: number
  coach_recommendation: string
  created_at: string
}

export interface Badge {
  key: string
  title: string
  description: string
  unlocked: boolean
  current: number
  target: number
}

export interface Task {
  id: string
  goal_id: string
  milestone_id: string | null
  description: string
  tip: string
  assigned_date: string
  position: number
  is_completed: boolean
  completed_at: string | null
  is_rescue_task: boolean
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

export interface RewardDrop {
  tier: 'bonus' | 'crit' | 'jackpot'
  points_awarded: number
  collectible_type: 'theme' | 'title' | 'lore' | null
  collectible_key: string | null
  collectible_display_name: string | null
  collectible_body: string | null
}

export interface TaskCompleteResponse extends Task {
  reward_drop: RewardDrop | null
}

export interface Reward {
  id: string
  reward_type: 'theme' | 'title' | 'lore'
  reward_key: string
  display_name: string
  body: string | null
  is_equipped: boolean
  acquired_at: string
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
  progress: number
  created_at: string
  daily_tasks: Task[]
  completed_days: string[]
  rescue_mode: boolean
}
