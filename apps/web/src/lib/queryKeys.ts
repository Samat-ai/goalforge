const goalKeys = {
  all: (userId: string) => ['goals', userId] as const,
  list: (userId: string, params?: { limit: number; offset: number }) =>
    params ? ['goals', userId, params] as const : ['goals', userId] as const,
  detail: (goalId: string) => ['goal', goalId] as const,
}

export const queryKeys = {
  goals: (userId: string, params?: { limit: number; offset: number }) =>
    params ? ['goals', userId, params] as const : ['goals', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  settings: (userId: string) => ['settings', userId] as const,
  pushSubscriptions: (userId: string) => ['pushSubscriptions', userId] as const,
  weeklyReflectionLatest: (userId: string) => ['weeklyReflectionLatest', userId] as const,
  weeklyReview: (userId: string, days: number) => ['weeklyReview', userId, days] as const,
  starLog: (userId: string, days: number) => ['starLog', userId, days] as const,
  shopRewards: (userId: string) => ['shopRewards', userId] as const,
  badges: (userId: string) => ['badges', userId] as const,
  accountability: (userId: string) => ['accountability', userId] as const,
  coachSession: (userId: string) => ['coachSession', userId] as const,
  notes: (goalId: string) => [...goalKeys.detail(goalId), 'notes'] as const,
}
