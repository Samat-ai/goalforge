import { useState } from 'react'

export type UpgradeFeature = 'goals' | 'coaching' | 'energy' | 'analytics' | 'accountability' | 'export'

export function useUpgradePrompt() {
  const [activeFeature, setActiveFeature] = useState<UpgradeFeature | null>(null)
  const showUpgrade = (feature: UpgradeFeature) => setActiveFeature(feature)
  const hideUpgrade = () => setActiveFeature(null)
  return { activeFeature, showUpgrade, hideUpgrade }
}
