import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export default function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: 'var(--border-hi)', borderRadius: 6, ...style }}
    />
  )
}

export function GoalCardSkeleton() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Skeleton style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 14, width: '55%' }} />
          <Skeleton style={{ height: 10, width: '35%' }} />
        </div>
        <Skeleton style={{ height: 22, width: 60, borderRadius: 99, flexShrink: 0 }} />
      </div>
      <Skeleton style={{ height: 4, width: '100%', borderRadius: 99, marginBottom: 18 }} />
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

export function CoachPanelSkeleton() {
  return (
    <section style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card-hi)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton style={{ height: 10, width: 130 }} />
        <Skeleton style={{ height: 6, width: 180, borderRadius: 99 }} />
        <Skeleton style={{ height: 10, width: 80, marginLeft: 'auto' }} />
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ alignSelf: 'flex-start', width: 'min(75%, 560px)' }}>
          <Skeleton style={{ height: 9, width: 40, marginBottom: 8 }} />
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-hi)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
            <Skeleton style={{ height: 12, width: '88%' }} />
            <Skeleton style={{ height: 12, width: '62%' }} />
          </div>
        </div>
        <div style={{ alignSelf: 'flex-end', width: 'min(55%, 400px)' }}>
          <Skeleton style={{ height: 9, width: 30, marginBottom: 8, marginLeft: 'auto' }} />
          <div style={{ borderRadius: 12, border: '1px solid var(--border-hi)', background: 'var(--card-hi)', padding: '10px 12px' }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
          </div>
        </div>
        <div style={{ alignSelf: 'flex-start', width: 'min(70%, 520px)' }}>
          <Skeleton style={{ height: 9, width: 40, marginBottom: 8 }} />
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-hi)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton style={{ height: 12, width: '100%' }} />
            <Skeleton style={{ height: 12, width: '70%' }} />
          </div>
        </div>
      </div>
    </section>
  )
}
