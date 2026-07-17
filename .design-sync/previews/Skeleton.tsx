// Authored preview — Skeleton (base loading block; size via style, pulse via Tailwind).
import { Skeleton } from 'web'
import type { CSSProperties, ReactNode } from 'react'

const Surface = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="gf-root" style={{ minHeight: 0, padding: 20, borderRadius: 14, ...style }}>
    {children}
  </div>
)

export function TextBlock() {
  return (
    <Surface style={{ maxWidth: 380 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <Skeleton style={{ width: 40, height: 40, borderRadius: 99 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Skeleton style={{ height: 12, width: '50%' }} />
          <Skeleton style={{ height: 9, width: '30%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton style={{ height: 11, width: '100%' }} />
        <Skeleton style={{ height: 11, width: '86%' }} />
        <Skeleton style={{ height: 11, width: '62%' }} />
      </div>
    </Surface>
  )
}
