export const queryKeys = {
  goals: (userId: string, params?: { limit: number; offset: number }) =>
    params ? ['goals', userId, params] as const : ['goals', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  settings: (userId: string) => ['settings', userId] as const,
  partners: (userId: string) => ['partners', userId] as const,
}
