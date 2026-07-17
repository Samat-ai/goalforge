// suggestions.ts — decides when Solly proactively offers Focus / Low-energy mode.
// Pure decision logic: pickSuggestion takes `now` and snooze state as data so
// Vitest (node env, no localStorage) can cover every branch. The rescue-card
// house pattern applies: we auto-DETECT the condition, the user EXECUTES.
import type { Goal } from './types'
import { goalIsDying } from './goalView'
import { pickOneThing } from './pickOneThing'
import { todayStr } from './gamification'

export type SuggestionType = 'energy' | 'focus'

export interface Suggestion {
  type: SuggestionType
  title: string
  body: string
  cta: string
}

/** Epoch-ms of each type's last dismissal, null if never dismissed. */
export interface SnoozeState {
  energy: number | null
  focus: number | null
}

// ~20h: dismissing today keeps the banner away until tomorrow, mirroring the
// rescue card's RESCUE_DISMISS_MS pattern (GoalCard.tsx).
export const SUGGEST_SNOOZE_MS = 20 * 60 * 60 * 1000

const ENERGY_HOUR = 14 // afternoon with nothing done = rough-day signal
const ENERGY_MIN_PENDING = 3
const FOCUS_MIN_ACTIONABLE = 5

// Copy variants are picked by calendar date, not Math.random() — deterministic
// render output (compiler purity rule) and stable across re-renders.
const ENERGY_VARIANTS: Omit<Suggestion, 'type'>[] = [
  {
    title: 'Big day? Let’s shrink it.',
    body: 'Nothing checked off yet and the list looks heavy. I can trim today into two-minute sparks.',
    cta: 'Make today lighter',
  },
  {
    title: 'Low fuel is still fuel.',
    body: 'We don’t need a blazing star today — a flicker counts. Want me to resize today into tiny wins?',
    cta: 'Simplify today',
  },
  {
    title: 'There’s an easier orbit.',
    body: 'Afternoon’s here and today hasn’t started — that’s fine. Let’s make the first step laughably small.',
    cta: 'Shrink my tasks',
  },
]

const FOCUS_VARIANTS: Omit<Suggestion, 'type'>[] = [
  {
    title: 'Lots of sparks, one match.',
    body: 'There’s a pile out there. Don’t pick — I already found the one thing that matters most right now.',
    cta: 'Show me one thing',
  },
  {
    title: 'One star at a time.',
    body: 'Everything is calling at once. Ignore the chorus — I’ll spotlight your single best next step.',
    cta: 'Focus me',
  },
]

function variantFor(type: SuggestionType, now: Date): Suggestion {
  const pool = type === 'energy' ? ENERGY_VARIANTS : FOCUS_VARIANTS
  return { type, ...pool[now.getDate() % pool.length] }
}

/** At most one suggestion, energy first. Null when the moment is wrong:
 * rescue/dying cards outrank the banner (one nudge at a time, same priority
 * idea as the jobs.py notification chain), snoozes are respected, and any
 * completion today means the user does not need a push. */
export function pickSuggestion(goals: Goal[], now: Date, snooze: SnoozeState): Suggestion | null {
  const active = goals.filter(g => g.status === 'active')
  if (active.some(g => g.rescue_mode || goalIsDying(g))) return null

  const today = todayStr()
  let incompleteToday = 0
  let completedToday = 0
  let unresizedToday = 0
  let overdueIncomplete = 0
  for (const g of active) {
    for (const t of g.daily_tasks) {
      if (t.assigned_date === today) {
        if (t.is_completed) {
          completedToday++
        } else {
          incompleteToday++
          if (t.original_description == null) unresizedToday++
        }
      } else if (t.assigned_date < today && !t.is_completed) {
        overdueIncomplete++
      }
    }
  }
  if (completedToday > 0) return null

  const snoozed = (t: SuggestionType) => {
    const ts = snooze[t]
    return ts != null && now.getTime() - ts < SUGGEST_SNOOZE_MS
  }

  if (
    now.getHours() >= ENERGY_HOUR &&
    incompleteToday >= ENERGY_MIN_PENDING &&
    unresizedToday > 0 &&
    !snoozed('energy')
  ) {
    return variantFor('energy', now)
  }

  const actionable = incompleteToday + overdueIncomplete
  if (
    actionable >= FOCUS_MIN_ACTIONABLE &&
    !snoozed('focus') &&
    pickOneThing(goals) !== null
  ) {
    return variantFor('focus', now)
  }

  return null
}

// ── localStorage bridge — call only from lazy state initializers / event
// handlers (node-env unit tests never touch these) ───────────────────────────
export const snoozeKey = (t: SuggestionType) => `gf_suggest_snooze_${t}`

export function readSnoozeState(): SnoozeState {
  const read = (t: SuggestionType): number | null => {
    const raw = localStorage.getItem(snoozeKey(t))
    const ts = raw == null ? NaN : Number(raw)
    return Number.isFinite(ts) ? ts : null
  }
  return { energy: read('energy'), focus: read('focus') }
}

export function writeSnooze(t: SuggestionType): void {
  localStorage.setItem(snoozeKey(t), String(Date.now()))
}
