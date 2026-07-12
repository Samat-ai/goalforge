// coachView.ts — view-model helpers for the coach session rail + header. Transcribed
// from design_handoff_goalforge/chat-v2/gf-coach-v2.jsx: fallbackTitle (lines 320-325),
// bucketOf/BUCKET_ORDER (lines 73-82), relTime (lines 61-70).
//
// All time-dependent functions take `now` (epoch ms) as an explicit parameter instead
// of reading Date.now() internally — Date.now()/new Date() is banned in render bodies
// repo-wide (ESLint react-hooks purity gate). Purity lives at the callsite: components
// source `now` once via a lazy useState initializer (see CoachRail.tsx).

const FALLBACK_TRUNCATE_LEN = 42

export interface TitleInfo {
  text: string
  fallback: boolean
}

/**
 * Resolves the display title for a coach session. An explicit title always wins;
 * otherwise the preview (first user message, server-truncated to 80 chars by
 * `GET /coach/sessions` — see apps/api/routes/coach.py) is truncated to 42 chars +
 * an ellipsis; failing that, the final fallback is 'Intake session'. Fallback results
 * render italic + muted (`.is-fallback`) in the rail row / chat header.
 */
export function fallbackTitle(sess: { title: string | null; preview?: string | null }): TitleInfo {
  if (sess.title) return { text: sess.title, fallback: false }
  const preview = sess.preview
  if (preview) {
    const text = preview.length > FALLBACK_TRUNCATE_LEN
      ? preview.slice(0, FALLBACK_TRUNCATE_LEN).trim() + '…'
      : preview
    return { text, fallback: true }
  }
  return { text: 'Intake session', fallback: true }
}

// Time-bucket group headers for the rail (leading-app pattern: Claude/Grok/Notion) —
// conveys relative recency without a timestamp on every row. Order preserved within
// a bucket by caller (insertion order of `sessions`).
export type Bucket = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | 'Older'

export const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']

/** Time-bucket for a session's `updated_at`. `now` is epoch ms, caller-sourced. */
export function bucketOf(iso: string, now: number): Bucket {
  const d = (now - new Date(iso).getTime()) / 86_400_000
  if (d < 1) return 'Today'
  if (d < 2) return 'Yesterday'
  if (d < 7) return 'Previous 7 days'
  if (d < 30) return 'Previous 30 days'
  return 'Older'
}

/** Relative-time string for the rail / chat-header subline. `now` is epoch ms, caller-sourced. */
export function relTime(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  const s = Math.max(1, Math.round((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return `${Math.round(d / 7)}w ago`
}

// Source of truth: apps/api/services/coach_service.py::CAP_MESSAGE — copied verbatim.
// Cap detection keys off exact content equality with this string; drift here silently
// degrades the resting-Solly cap moment (header "Resting until tomorrow" + rest bubble)
// down to a plain coach bubble instead of throwing, so keep this in sync by hand.
export const CAP_MESSAGE =
  "My forge needs to cool until tomorrow. We covered real ground today. Come back and we'll pick it up."

export function isCapMessage(content: string): boolean {
  return content === CAP_MESSAGE
}
