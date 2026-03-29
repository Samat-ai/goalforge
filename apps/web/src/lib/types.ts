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
  reminder_enabled: boolean
  reminder_hour: number
}

export interface UserSettingsUpdatePayload {
  timezone?: string | null
  display_name?: string | null
  reminder_enabled?: boolean | null
  reminder_hour?: number | null
}

export interface AccountabilityInvite {
  id: string
  inviter_user_id: string
  invitee_user_id: string | null
  target_email: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  responded_at: string | null
  inviter_email: string | null
  inviter_display_name: string | null
}

export interface AccountabilityPartner {
  id: string
  user_id: string
  partner_user_id: string
  partner_email: string
  partner_display_name: string | null
  created_at: string
}

export interface AccountabilityOverview {
  incoming: AccountabilityInvite[]
  outgoing: AccountabilityInvite[]
  partners: AccountabilityPartner[]
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  is_active: boolean
  created_at: string
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

export interface WeeklyReviewResponse {
  start_date: string
  end_date: string
  total_tasks: number
  completed_tasks: number
  completion_rate: number
  completed_days: number
  overdue_tasks: number
  risk_level: 'low' | 'medium' | 'high'
  recommendation: string
}

export interface StarLogResponse {
  id: string
  user_id: string
  start_date: string
  end_date: string
  completed_tasks: number
  completed_days: number
  chapter_title: string
  chapter_body: string
  highlights: string[]
  is_fallback: boolean
  created_at: string
}

export interface ShopReward {
  id: string
  user_id: string
  title: string
  cost: number
  is_active: boolean
  redemption_count: number
  created_at: string
}

export interface ShopRewardRedeemResponse {
  reward: ShopReward
  remaining_star_points: number
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
  original_description: string | null
  original_tip: string | null
}

export interface EnergyResizeResponse {
  tasks_resized: number
  tasks: Task[]
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
  points_awarded: number
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

export interface CoachMessage {
  id: string
  session_id: string
  role: 'coach' | 'user'
  content: string
  created_at: string
}

export interface CoachSession {
  id: string
  user_id: string
  stage: number
  is_completed: boolean
  forged_goal_id: string | null
  created_at: string
  updated_at: string
  messages: CoachMessage[]
}

export interface CoachSendMessageResponse {
  session: CoachSession
  forged_goal: Goal | null
}
