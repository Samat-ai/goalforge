import type { CSSProperties } from 'react'
import { T } from '../../lib/theme'

interface SkeletonProps {
  /** Extra Tailwind classes (e.g. 'rounded-full', 'w-full') */
  className?: string
  style?: CSSProperties
}

/**
 * Base skeleton pulse block.
 * Compose these to build loading shapes that match real content dimensions,
 * so the layout does not shift when data arrives.
 */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        background: T.borderHi,
        borderRadius: 6,
        ...style,
      }}
    />
  )
}

export default Skeleton

// ── Compound skeletons ────────────────────────────────────────────────────────

/** Mimics a single GoalCard while goals are loading */
export function GoalCardSkeleton() {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: '20px 22px',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Skeleton style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 14, width: '55%' }} />
          <Skeleton style={{ height: 10, width: '35%' }} />
        </div>
        <Skeleton style={{ height: 22, width: 60, borderRadius: 99, flexShrink: 0 }} />
      </div>

      {/* Progress bar */}
      <Skeleton style={{ height: 4, width: '100%', borderRadius: 99, marginBottom: 18 }} />

      {/* Task rows */}
      {[0.9, 0.75, 0.6].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Skeleton style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
          <Skeleton style={{ height: 11, flex: 1, maxWidth: `${w * 100}%` }} />
          <Skeleton style={{ height: 11, width: 52, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}

/** Mimics a single task row (checkbox + label + date chip) */
export function TaskItemSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Skeleton style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
      <Skeleton style={{ height: 11, flex: 1 }} />
      <Skeleton style={{ height: 11, width: 52, flexShrink: 0 }} />
    </div>
  )
}

/** Mimics an analytics stat card (large number + label) */
export function StatCardSkeleton() {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 9,
      padding: '13px 15px',
    }}>
      <Skeleton style={{ height: 26, width: '45%', marginBottom: 8 }} />
      <Skeleton style={{ height: 10, width: '65%' }} />
    </div>
  )
}

/** Mimics a single note list item (avatar + title + timestamp) */
export function NoteItemSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
      <Skeleton style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Skeleton style={{ height: 12, width: '70%' }} />
        <Skeleton style={{ height: 10, width: '40%' }} />
      </div>
    </div>
  )
}

/** Mimics the Coach chat panel while the session is loading */
export function CoachPanelSkeleton() {
  return (
    <section style={{
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.card,
      overflow: 'hidden',
    }}>
      {/* Progress header */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <Skeleton style={{ height: 10, width: 130 }} />
        <Skeleton style={{ height: 6, width: 180, borderRadius: 99 }} />
        <Skeleton style={{ height: 10, width: 80, marginLeft: 'auto' }} />
      </div>

      {/* Chat bubbles */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Coach bubble (left-aligned) */}
        <div style={{ alignSelf: 'flex-start', width: 'min(75%, 560px)' }}>
          <Skeleton style={{ height: 9, width: 40, marginBottom: 8 }} />
          <div style={{
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.surface,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
            <Skeleton style={{ height: 12, width: '88%' }} />
            <Skeleton style={{ height: 12, width: '62%' }} />
          </div>
        </div>

        {/* User bubble (right-aligned) */}
        <div style={{ alignSelf: 'flex-end', width: 'min(55%, 400px)' }}>
          <Skeleton style={{ height: 9, width: 30, marginBottom: 8, marginLeft: 'auto' }} />
          <div style={{
            borderRadius: 12,
            border: `1px solid ${T.borderHi}`,
            background: T.surface,
            padding: '10px 12px',
          }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
          </div>
        </div>

        {/* Coach second bubble (left-aligned) */}
        <div style={{ alignSelf: 'flex-start', width: 'min(70%, 520px)' }}>
          <Skeleton style={{ height: 9, width: 40, marginBottom: 8 }} />
          <div style={{
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.surface,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
            <Skeleton style={{ height: 12, width: '70%' }} />
          </div>
        </div>
      </div>
    </section>
  )
}
