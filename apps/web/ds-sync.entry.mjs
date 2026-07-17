// design-sync barrel — the presentational components synced to claude.ai/design
// (window.GoalForge). Referenced by .design-sync/config.json `entry`; NOT part of
// the app build (tsconfig.app.json includes src/ only, Vite bundles from index.html).
// Keep in step with componentSrcMap when scope changes.
export { Icon, Reveal, Switcher, Ring, Flame, Sparkline, Mascot, Segmented, Toggle } from './src/components/gf/Ui'
export { default as Skeleton, GoalCardSkeleton, CoachPanelSkeleton } from './src/components/ui/Skeleton'
export { default as RewardModal } from './src/components/RewardModal'
export { default as CollectionModal } from './src/components/CollectionModal'
