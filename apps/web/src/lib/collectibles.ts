// Collectible registry sizes — must match reward_service.REWARD_REGISTRY on the
// backend. Shared by CollectionModal (locked-slot math) and the Logs page
// TrophyStrip ("X / N collected").
export const REGISTRY_COUNTS = { theme: 4, title: 12, lore: 6 }
export const REGISTRY_TOTAL = REGISTRY_COUNTS.theme + REGISTRY_COUNTS.title + REGISTRY_COUNTS.lore
