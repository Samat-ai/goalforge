// gf/CoachRail.tsx — session rail, shared by the desktop sidebar and the mobile
// drawer. Transcribed from design_handoff_goalforge/chat-v2/gf-coach-v2.jsx
// Rail/RailItem (lines 327-391).
import { useState } from 'react'
import { Icon } from './Ui'
import { cx } from './util'
import { BUCKET_ORDER, bucketOf, fallbackTitle, type Bucket } from '../../lib/coachView'
import type { CoachSessionListItem } from '../../lib/types'

interface RailItemProps {
  sess: CoachSessionListItem
  active: boolean
  confirming: boolean
  onSelect: () => void
  onAskDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function RailItem({ sess, active, confirming, onSelect, onAskDelete, onConfirmDelete, onCancelDelete }: RailItemProps) {
  const { text, fallback } = fallbackTitle(sess)
  if (confirming) {
    return (
      <div className="gf-co-rail-item is-confirm">
        <div className="gf-co-rail-confirm">
          <span className="gf-co-rail-confirm-t">Delete this chat?</span>
          <button className="gf-co-rail-cbtn" aria-label="Cancel delete" onClick={onCancelDelete}><Icon name="x" size={15} /></button>
          <button className="gf-co-rail-cbtn is-danger" aria-label="Confirm delete" onClick={onConfirmDelete}><Icon name="trash" size={15} /></button>
        </div>
      </div>
    )
  }
  return (
    <div className={cx('gf-co-rail-item', active && 'is-active')}>
      {/* Inline style kept verbatim from the package: only `border`/`background`/`color`
          are covered by the global `button` reset (index.css:242) and `padding` by the
          global `* { padding: 0 }` reset (index.css:226) — `.gf-co-rail-main` (index.css)
          does not itself declare `text-align` or `min-height`, so the button would
          otherwise inherit the UA default `text-align: center` and a content-driven
          min-height taller than intended. */}
      <button
        className="gf-co-rail-main"
        onClick={onSelect}
        style={{ background: 'none', textAlign: 'left', color: 'inherit', minHeight: 0, padding: 0, border: 'none' }}
      >
        <div className={cx('gf-co-rail-title', fallback && 'is-fallback')}>{text}</div>
      </button>
      <button className="gf-co-rail-del" aria-label={`Delete chat: ${text}`} onClick={onAskDelete}><Icon name="trash" size={15} /></button>
    </div>
  )
}

export interface CoachRailProps {
  sessions: CoachSessionListItem[]
  activeId: string | null
  confirmId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  setConfirmId: (id: string | null) => void
  onDelete: (id: string) => void
  collapsible?: boolean
  onCollapse?: () => void
}

export default function CoachRail({
  sessions, activeId, confirmId, onSelect, onNewChat, setConfirmId, onDelete, collapsible, onCollapse,
}: CoachRailProps) {
  // Lazy init: reads Date.now() once at mount, never in the render body itself (the
  // repo's ESLint purity gate bans bare Date.now()/new Date() in render). The rail
  // remounts whenever the drawer opens and the session list refetches on every send,
  // so this snapshot is bounded and irrelevant in practice — buckets are day-granular.
  const [now] = useState(() => Date.now())

  const groups: Partial<Record<Bucket, CoachSessionListItem[]>> = {}
  for (const s of sessions) {
    const b = bucketOf(s.updated_at, now)
    const list = groups[b]
    if (list) list.push(s)
    else groups[b] = [s]
  }

  return (
    <div className="gf-co-rail">
      <div className="gf-co-rail-head">
        {collapsible && (
          <div className="gf-co-rail-top">
            <button className="gf-co-railtoggle" aria-label="Collapse sidebar" onClick={onCollapse}><Icon name="panel" size={18} /></button>
          </div>
        )}
        <button className="gf-co-newchat" onClick={onNewChat}>
          <span className="gf-co-newchat-ic"><Icon name="plus" size={16} stroke={2.4} /></span> New chat
        </button>
      </div>
      {sessions.length === 0 ? (
        <div className="gf-co-rail-empty">
          <div className="gf-co-rail-empty-ic"><Icon name="chat" size={19} /></div>
          <div className="gf-co-rail-empty-t">No conversations yet</div>
          <div className="gf-co-rail-empty-s">Start a new chat and Solly will<br />forge your first goal.</div>
        </div>
      ) : (
        <div className="gf-co-rail-list">
          {BUCKET_ORDER.filter(b => groups[b]).map(b => {
            const items = groups[b] ?? []
            return (
              <div key={b} className="gf-co-rail-group">
                <div className="gf-co-rail-cap">{b}</div>
                {items.map(s => (
                  <RailItem
                    key={s.id}
                    sess={s}
                    active={s.id === activeId}
                    confirming={confirmId === s.id}
                    onSelect={() => onSelect(s.id)}
                    onAskDelete={() => setConfirmId(s.id)}
                    onCancelDelete={() => setConfirmId(null)}
                    onConfirmDelete={() => onDelete(s.id)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
