// gf/GoalCard.tsx — collapsible goal card with today / sprints / history tabs.
// Transcribed from design_handoff_goalforge/app/gf-goalcard.jsx. Mock task
// toggling is replaced with real completeTask/uncompleteTask-shaped mutations
// (props from Dashboard — the single useGoalMutations owner, per CLAUDE.md).
// Real backend states the mock never needed (sprint_status generating/failed,
// achieved/abandoned goals reusing this same card) are added as minimal,
// CSS-class-reuse-only extensions; see task-1-report.md for the list.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon, Reveal } from './Ui'
import { cx, gfHideTip, gfTip } from './util'
import { toGoalView, type GoalViewTask } from '../../lib/goalView'
import { todayStr } from '../../lib/gamification'
import type { Goal } from '../../lib/types'
import type { useGoalMutations } from '../../hooks/useGoalMutations'

type TaskPosition = { id: string; position: number }
interface TaskRowActions {
  onToggle: () => void
  onRestore: () => void
  onSaveEdit: (taskId: string, description: string) => void
  onRegenerate: (taskId: string) => Promise<void>
}

type Mutations = ReturnType<typeof useGoalMutations>

const RESCUE_DISMISS_MS = 8 * 60 * 60 * 1000 // "show my full plan" hides the rescue card for 8h

// ── PuffyStar (brightness-driven signature glyph) ───────────────────────────────
function PuffyStar({ brightness = 0.8, size = 46, dying = false }: { brightness?: number; size?: number; dying?: boolean }) {
  // Prototype used Math.random() for the gradient id; useId is the ESLint-clean
  // equivalent (impure-function-in-render is banned project-wide).
  const uid = 'ps' + useId()
  const n = brightness
  const glowRgb = dying ? '148,163,184' : '251,191,36'
  return (
    <div className={cx('gf-puffy', dying && 'is-dying')} style={{ width: size, height: size }}>
      <div className="gf-puffy-glow" style={{ background: `radial-gradient(circle, rgba(${glowRgb},${0.04 + n * 0.38}) 30%, transparent 72%)` }} />
      <svg viewBox="0 0 100 100" width={size * 0.86} height={size * 0.86} style={{ position: 'relative', zIndex: 1, overflow: 'visible' }}>
        <defs>
          <radialGradient id={uid} cx="40%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0.12 + n * 0.83} />
          </radialGradient>
        </defs>
        <polygon points="50,12 59.9,36.2 86.1,38.3 66.2,55.3 72.4,80.7 50,67 27.6,80.7 33.8,55.3 13.9,38.3 40.1,36.2"
          fill={`url(#${uid})`} stroke="rgba(251,191,36,0.35)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Completion calendar (8 weeks) ───────────────────────────────────────────────
const GC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GC_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function gcPretty(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${GC_DOW[dt.getDay()]}, ${GC_MON[m - 1]} ${d}`
}
type CalCell = { iso: string; state: 'future' | 'done' | 'miss' }
function MiniCalendar({ days }: { days: string[] }) {
  const set = useMemo(() => new Set(days), [days])
  const weeks = useMemo<CalCell[][]>(() => {
    const total = 56
    const todayIso = todayStr()
    const today = new Date(`${todayIso}T12:00:00`)
    const start = new Date(today); start.setDate(start.getDate() - (total - 1))
    const dow = (start.getDay() + 6) % 7 // 0 = Monday
    start.setDate(start.getDate() - dow) // align back to Monday
    const cells: CalCell[] = []
    for (let i = 0; i < total; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const iso = new Intl.DateTimeFormat('en-CA').format(d)
      cells.push({ iso, state: d > today ? 'future' : set.has(iso) ? 'done' : 'miss' })
    }
    const w: CalCell[][] = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [set])
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="gf-cal">
      <div className="gf-cal-labels">
        {labels.map((l, i) => <span key={i} className="gf-cal-lbl">{l}</span>)}
      </div>
      <div className="gf-cal-weeks">
        {weeks.map((wk, wi) => (
          <div key={wi} className="gf-cal-col">
            {wk.map((c, di) => (
              <span key={di} className={cx('gf-cal-cell', c.state === 'done' && 'is-done', c.state === 'future' && 'is-future')}
                onMouseMove={c.state === 'future' ? undefined : (e) => gfTip(e, `<b>${c.state === 'done' ? 'Completed' : 'No activity'}</b><span>${gcPretty(c.iso)}</span>`)}
                onMouseLeave={c.state === 'future' ? undefined : gfHideTip} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Streak bars ─────────────────────────────────────────────────────────────────
function StreakBars({ days }: { days: string[] }) {
  const { streaks, longest, current, total } = useMemo(() => {
    const set = new Set(days)
    const todayIso = todayStr()
    const today = new Date(`${todayIso}T12:00:00`)
    const arr: boolean[] = []
    for (let i = 55; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      arr.push(set.has(new Intl.DateTimeFormat('en-CA').format(d)))
    }
    const sk: { start: number; len: number }[] = []
    let i = 0
    while (i < arr.length) {
      if (arr[i]) { const s = i; while (i < arr.length && arr[i]) i++; sk.push({ start: s, len: i - s }) }
      else i++
    }
    const longest = Math.max(...sk.map(s => s.len), 1)
    let current = 0
    if (arr[arr.length - 1]) { let j = arr.length - 1; while (j >= 0 && arr[j]) { current++; j-- } }
    return { streaks: sk, longest, current, total: arr.filter(Boolean).length }
  }, [days])
  return (
    <div>
      <div className="gf-sb-stats">
        {([['Current', current], ['Longest', longest], ['Total', total]] as const).map(([l, v]) => (
          <div key={l}><div className="gf-sb-lbl">{l}</div><div className="gf-sb-val">{v}<span>days</span></div></div>
        ))}
      </div>
      <div className="gf-sb-track">
        <div className="gf-sb-baseline" />
        {streaks.map((s, idx) => {
          const left = (s.start / 56) * 100, width = Math.max((s.len / 56) * 100, 0.6)
          const isCur = idx === streaks.length - 1 && current > 0
          const h = 4 + Math.round((s.len / longest) * 18)
          return <div key={idx} className={cx('gf-sb-bar', isCur && 'is-cur', s.len === longest && 'is-long')}
            onMouseMove={(e) => gfTip(e, `<b>${s.len}</b>-day streak${isCur ? '<span>current · ongoing</span>' : s.len === longest ? '<span>longest streak</span>' : ''}`)}
            onMouseLeave={gfHideTip}
            style={{ left: `${left}%`, width: `${width}%`, height: h, top: `${20 - h / 2}px` }} />
        })}
      </div>
    </div>
  )
}

// ── Tab content ─────────────────────────────────────────────────────────────────
// Drag props injected by SortableTaskRow (today's list only). Absent for overdue rows.
interface SortableParts {
  setNodeRef: (el: HTMLElement | null) => void
  style: React.CSSProperties
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: ReturnType<typeof useSortable>['listeners']
  isDragging: boolean
}

interface TaskRowProps extends TaskRowActions {
  task: GoalViewTask
  overdue?: boolean
  editMode?: boolean // touch edit-mode forces the grip + action icons visible
  sortable?: SortableParts
}

function TaskRow({ task, overdue, editMode, sortable, onToggle, onRestore, onSaveEdit, onRegenerate }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.title)
  const [regenerating, setRegenerating] = useState(false)

  const canEdit = !task.done
  const canRegen = !task.done && !task.isUserAdded
  const showGrip = !!sortable && !task.done

  const startEdit = () => { setText(task.title); setEditing(true) }
  const saveEdit = () => {
    const next = text.trim()
    if (next && next !== task.title) onSaveEdit(task.id, next)
    setEditing(false)
  }
  const cancelEdit = () => { setText(task.title); setEditing(false) }
  const regen = async () => {
    if (regenerating) return
    setRegenerating(true)
    try { await onRegenerate(task.id) } catch { /* toast handled by mutation onError */ } finally { setRegenerating(false) }
  }

  const rowClass = cx('gf-task', task.done && 'is-done', overdue && 'is-overdue', editMode && 'is-editmode', sortable?.isDragging && 'is-dragging')

  const inner = (
    <>
      {showGrip && (
        <button className="gf-task-grip" type="button" aria-label="Drag to reorder"
          {...sortable!.attributes} {...(sortable!.listeners ?? {})}>
          <Icon name="grip" size={15} />
        </button>
      )}
      {editing ? (
        <input
          className="gf-task-edit-input"
          value={text}
          autoFocus
          aria-label="Edit task description"
          onChange={e => setText(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
          }}
        />
      ) : (
        <button className="gf-task-toggle" type="button" onClick={onToggle} disabled={task.done}
          aria-label={task.done ? 'Task completed' : 'Mark task complete'}>
          <span className="gf-check"><Icon name="check" size={13} stroke={3} /></span>
          <span className="gf-task-label">{task.title}</span>
        </button>
      )}
      {!editing && overdue && !task.done && <span className="gf-task-tag">overdue</span>}
      {!editing && task.resized && !task.done && <span className="gf-task-tag">simplified</span>}
      {!editing && (canEdit || canRegen) && (
        <div className="gf-task-actions">
          {canEdit && (
            <button className="gf-task-action" type="button" aria-label="Edit task" onClick={startEdit}>
              <Icon name="pencil" size={14} />
            </button>
          )}
          {canRegen && (
            <button className="gf-task-action" type="button" aria-label="Regenerate task" onClick={() => void regen()} disabled={regenerating}>
              <Icon name="refresh" size={14} className={cx(regenerating && 'gf-spin')} />
            </button>
          )}
        </div>
      )}
    </>
  )

  if (!task.resized || task.done) {
    return <div ref={sortable?.setNodeRef} style={sortable?.style} className={rowClass}>{inner}</div>
  }
  return (
    <div ref={sortable?.setNodeRef} style={sortable?.style} className="gf-task-wrap">
      <div className={rowClass}>{inner}</div>
      <button className="gf-task-restore" type="button" onClick={onRestore} aria-label="Restore original task">restore ↩</button>
    </div>
  )
}

// Inline "add a custom task" affordance (is_user_added=true server-side). Collapsed to a ghost
// button; expands to an input. A submit guard prevents an Enter-then-blur double-create.
function AddTaskRow({ onAdd }: { onAdd: (description: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const submitted = useRef(false)
  const submit = () => {
    if (submitted.current) return
    submitted.current = true
    const next = text.trim()
    if (next) onAdd(next)
    setText('')
    setOpen(false)
  }
  if (!open) {
    return (
      <button className="gf-task-add-btn" type="button"
        onClick={() => { submitted.current = false; setOpen(true) }}>
        <Icon name="plus" size={13} /> Add a task
      </button>
    )
  }
  return (
    <div className="gf-task-add">
      <input
        className="gf-task-edit-input"
        value={text}
        autoFocus
        placeholder="Describe a task…"
        aria-label="New task description"
        onChange={e => setText(e.target.value)}
        onBlur={submit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          else if (e.key === 'Escape') { e.preventDefault(); setText(''); setOpen(false) }
        }}
      />
    </div>
  )
}

// Today's tasks are sortable — must render inside <DndContext><SortableContext> (project rule:
// useSortable always mounts under a context, even when disabled). Overdue rows use TaskRow directly.
function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id, disabled: props.task.done })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
    position: isDragging ? 'relative' : undefined,
  }
  return <TaskRow {...props} sortable={{ setNodeRef, style, attributes, listeners, isDragging }} />
}

interface TodayTabProps {
  goal: Goal
  onToggleTask: (taskId: string, done: boolean) => void
  onRestoreTask: (taskId: string) => void
  onSaveEdit: (taskId: string, description: string) => void
  onRegenerate: (taskId: string) => Promise<void>
  onReorder: (positions: TaskPosition[]) => void
  onAddTask: (description: string) => void
  onTriggerRescue: () => Promise<unknown>
  triggeringRescue: boolean
  onAbandon: () => void
  onDelete: () => void
  onCompleteSprint: () => void
  onRetryGeneration: () => void
  completingSprint: boolean
  retryingGeneration: boolean
  confirm: 'abandon' | 'delete' | null
  setConfirm: (v: 'abandon' | 'delete' | null) => void
}

function TodayTab({
  goal, onToggleTask, onRestoreTask, onSaveEdit, onRegenerate, onReorder, onAddTask,
  onTriggerRescue, triggeringRescue, onAbandon, onDelete, onCompleteSprint, onRetryGeneration,
  completingSprint, retryingGeneration, confirm, setConfirm,
}: TodayTabProps) {
  const view = toGoalView(goal)
  const dismissKey = `rescue_dismissed_${goal.id}`

  // Touch devices (no hover) get an explicit "Edit" mode toggle instead of hover-revealed
  // icons; desktop (hover:hover) reveals affordances via CSS. matchMedia can't run in render.
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [editMode, setEditMode] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarsePointer(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const todayIds = view.tasks.map(t => t.id)
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = todayIds.indexOf(String(active.id))
    const newIndex = todayIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    // Permute only the position values already held by today's tasks — never touch other days.
    const pool = view.tasks.map(t => t.position).slice().sort((a, b) => a - b)
    const positions = arrayMove(view.tasks, oldIndex, newIndex).map((t, i) => ({ id: t.id, position: pool[i] }))
    onReorder(positions)
  }
  // Lazy read only checks key presence — clock reads are banned in render.
  const [rescueDismissed, setRescueDismissed] = useState(() => localStorage.getItem(dismissKey) !== null)
  useEffect(() => {
    const ts = Number(localStorage.getItem(dismissKey))
    if (ts && Date.now() - ts >= RESCUE_DISMISS_MS) {
      localStorage.removeItem(dismissKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- expiring a persisted dismissal needs a clock read, which render/lazy-init may not do
      setRescueDismissed(false)
    }
  }, [dismissKey])

  function dismissRescue() {
    localStorage.setItem(dismissKey, String(Date.now()))
    setRescueDismissed(true)
  }

  async function handleStartEasyMode() {
    if (triggeringRescue) return
    try {
      await onTriggerRescue()
      dismissRescue() // only on success — prevents re-show during generation churn
    } catch {
      // error toast comes from the mutation's onError
    }
  }
  const isGenerating = goal.milestones.some(m => m.sprint_status === 'generating')
  const failedMilestone = goal.milestones.find(m => m.sprint_status === 'failed')
  const activeMilestone = goal.milestones.find(m => m.sprint_status === 'active')
  const currentSprintTasks = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved = goal.status === 'achieved'
  const isRescue = goal.rescue_mode && !rescueDismissed && !isAbandoned && !isAchieved
  const done = view.tasks.filter(t => t.done).length
  const total = view.tasks.length

  if (isGenerating) {
    return (
      <div className="gf-tabpane">
        <div className="gf-gen-state">
          <div className="gf-gen-icon">✦</div>
          <div>
            <div className="gf-gen-title">Building your plan…</div>
            <div className="gf-gen-sub">AI is generating milestones and tasks — this takes a few seconds</div>
          </div>
        </div>
      </div>
    )
  }

  if (failedMilestone) {
    return (
      <div className="gf-tabpane">
        <div className="gf-nudge is-rose">
          <div className="gf-nudge-body">
            <div className="gf-nudge-kicker">Sprint generation failed</div>
            <div className="gf-nudge-title">&ldquo;{failedMilestone.title}&rdquo; could not be generated.</div>
          </div>
          <button className="gf-btn-pill is-sprint" onClick={onRetryGeneration} disabled={retryingGeneration}>
            {retryingGeneration ? '···' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gf-tabpane">
      {isAbandoned && (
        <div className="gf-nudge gf-nudge-muted">
          <div className="gf-nudge-body">
            <div className="gf-nudge-kicker">{view.isFaded ? 'Star faded' : 'Abandoned'}</div>
            <div className="gf-nudge-title">
              {view.isFaded
                ? 'Your star faded while you were away — relight it anytime.'
                : 'Star faded — goal abandoned.'}
            </div>
          </div>
          <button className="gf-btn-pill" onClick={onAbandon}>Revive goal</button>
        </div>
      )}
      {isAchieved && <div className="gf-achieved-banner">🏆 Goal achieved — it lives in your Hall of Fame.</div>}

      {isRescue && (
        <div>
          <div className={cx('gf-rescue-badge', view.isDying && 'is-dying')}>
            {view.isDying ? '✦ FADING STAR' : '✦ EASY MODE'}
          </div>
          <div className="gf-rescue-title">
            {view.isDying ? 'Your star is about to go out.' : "Let's make today easy."}
          </div>
          <div className="gf-rescue-sub">
            {view.isDying
              ? 'It has been quiet out here, and the light is down to a flicker. One tiny spark is all it takes — two two-minute wins, no catching up, no guilt.'
              : "It looks like you've been busy. We paused your schedule and set up two quick wins for today — no pressure, no catching up."}
          </div>
          <button className="gf-btn-pill is-sprint" style={{ width: '100%', marginBottom: 10 }} onClick={() => void handleStartEasyMode()} disabled={triggeringRescue}>
            {triggeringRescue ? 'Starting easy mode…' : view.isDying ? 'Relight this star (2 min)' : 'Start Easy Mode (2 min)'}
          </button>
          <button onClick={dismissRescue} className="gf-rescue-dismiss">
            {view.isDying ? 'Still glowing — show my full plan' : "I'm feeling good — show my full plan"}
          </button>
        </div>
      )}

      {!isRescue && total > 0 && (
        <div className="gf-mini">
          <div className="gf-mini-track"><div className="gf-mini-fill" style={{ width: `${(done / total) * 100}%` }} /></div>
          <span className="gf-mini-c">{done}/{total} tasks</span>
          {coarsePointer && (
            <button className="gf-task-editmode" type="button" onClick={() => setEditMode(m => !m)} aria-pressed={editMode}>
              {editMode ? 'Done' : <><Icon name="pencil" size={12} /> Edit</>}
            </button>
          )}
        </div>
      )}
      {!isRescue && (
        <div className="gf-tasks">
          {view.overdue.map(t => (
            <TaskRow key={t.id} task={t} overdue editMode={editMode}
              onToggle={() => onToggleTask(t.id, t.done)} onRestore={() => onRestoreTask(t.id)}
              onSaveEdit={onSaveEdit} onRegenerate={onRegenerate} />
          ))}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={todayIds} strategy={verticalListSortingStrategy}>
              {view.tasks.map(t => (
                <SortableTaskRow key={t.id} task={t} editMode={editMode}
                  onToggle={() => onToggleTask(t.id, t.done)} onRestore={() => onRestoreTask(t.id)}
                  onSaveEdit={onSaveEdit} onRegenerate={onRegenerate} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {!isRescue && !isAbandoned && !isAchieved && (
        <AddTaskRow onAdd={onAddTask} />
      )}
      {!isAbandoned && !isAchieved && (
        <div className="gf-gc-actions">
          {allMilestonesComplete
            ? <span className="gf-gc-hint">All sprints complete</span>
            : allSprintTasksDone && activeMilestone
              ? <button className="gf-btn-pill is-sprint" onClick={onCompleteSprint} disabled={completingSprint}>
                  {completingSprint ? '···' : <><Icon name="spark" size={12} /> Complete Sprint → next</>}
                </button>
              : <span className="gf-gc-hint">{total - done} task{total - done === 1 ? '' : 's'} left today</span>}
          <button className={cx('gf-btn-pill is-warn', confirm === 'abandon' && 'is-armed')}
            onClick={() => (confirm === 'abandon' ? onAbandon() : setConfirm('abandon'))}>
            {confirm === 'abandon' ? 'Sure? Abandon' : 'Abandon'}
          </button>
          <button className={cx('gf-btn-pill is-danger', confirm === 'delete' && 'is-armed')}
            onClick={() => (confirm === 'delete' ? onDelete() : setConfirm('delete'))}>
            {confirm === 'delete' ? 'Sure? Delete' : 'Delete'}
          </button>
        </div>
      )}
      {(isAbandoned || isAchieved) && (
        <div className="gf-gc-actions">
          <button className="gf-btn-pill is-danger" onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}

const MS_STATUS = {
  completed: { cls: 'is-done', label: 'done' },
  active: { cls: 'is-active', label: 'active' },
  upcoming: { cls: 'is-up', label: '' },
  failed: { cls: 'is-fail', label: 'failed' },
} as const

function SprintsTab({ goal }: { goal: Goal }) {
  const view = toGoalView(goal)
  const totalM = view.milestones.length
  const doneM = view.milestones.filter(m => m.status === 'completed').length
  const pct = totalM ? Math.round((doneM / totalM) * 100) : 0
  return (
    <div className="gf-tabpane">
      <div className="gf-ov">
        <div className="gf-ov-top"><span className="gf-cap2">Overall progress</span><span className="gf-ov-pct">{pct}%</span></div>
        <div className="gf-bar"><div className="gf-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="gf-ov-sub">{doneM} of {totalM} sprints completed</div>
      </div>
      <div className="gf-cap2" style={{ marginBottom: 10 }}>Milestones</div>
      <div className="gf-ms-list">
        {view.milestones.map(m => {
          const s = MS_STATUS[m.status]
          return (
            <div key={m.pos} className="gf-ms">
              <span className={cx('gf-ms-dot', s.cls)}>{m.status === 'completed' ? <Icon name="check" size={11} stroke={3} /> : m.status === 'failed' ? '×' : m.pos}</span>
              <span className={cx('gf-ms-title', s.cls)}>{m.title}</span>
              {s.label && <span className={cx('gf-ms-tag', s.cls)}>{s.label}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistoryTab({ goal }: { goal: Goal }) {
  const [view, setView] = useState<'calendar' | 'streaks'>('streaks')
  const gv = toGoalView(goal)
  const b = gv.brightness
  const bMsg = gv.isDying
    ? 'Barely a spark — relight it before it goes dark'
    : b < 0.3 ? 'Almost out — complete tasks to recharge' : b < 0.6 ? 'Fading — keep going' : 'Burning bright'
  return (
    <div className="gf-tabpane">
      <div>
        <div className="gf-hh"><span className="gf-cap2">Star brightness</span><span className="gf-hh-r">{Math.round(b * 100)}%</span></div>
        <div className="gf-bar gf-bar-gold"><div className="gf-bar-fill" style={{ width: `${b * 100}%` }} /></div>
        <div className="gf-ov-sub" style={{ marginTop: 5 }}>{bMsg}</div>
      </div>
      <div>
        <div className="gf-hh">
          <span className="gf-cap2">Completion history <span className="gf-hh-dim">{gv.completed_days.length} days</span></span>
          <div className="gf-toggle">
            {(['calendar', 'streaks'] as const).map(v => (
              <button key={v} className={cx('gf-toggle-b', view === v && 'is-on')} onClick={() => setView(v)}>{v === 'calendar' ? 'weeks' : 'streaks'}</button>
            ))}
          </div>
        </div>
        {view === 'calendar' ? <MiniCalendar days={gv.completed_days} /> : <StreakBars days={gv.completed_days} />}
      </div>
      <div className="gf-about">
        <div className="gf-cap2" style={{ marginBottom: 7 }}>About this goal</div>
        <p className="gf-about-d">{gv.smart_description}</p>
        <p className="gf-about-q">&ldquo;{gv.raw_input}&rdquo;</p>
      </div>
    </div>
  )
}

// ── GoalCard ────────────────────────────────────────────────────────────────────
export interface GoalCardProps {
  goal: Goal
  index?: number
  defaultOpen?: boolean
  mutations: Mutations
  onRestoreTask: (taskId: string) => void
}

export default function GoalCard({ goal, index = 0, defaultOpen = false, mutations, onRestoreTask }: GoalCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<'today' | 'sprints' | 'history'>('today')
  const [confirm, setConfirm] = useState<'abandon' | 'delete' | null>(null)
  const [completingSprint, setCompletingSprint] = useState(false)

  const view = toGoalView(goal)
  const doneToday = view.tasks.length > 0 && view.tasks.every(t => t.done)
  const tabIndex = { today: 0, sprints: 1, history: 2 }[tab]
  const ratio = view.tasks.length ? view.tasks.filter(t => t.done).length / view.tasks.length : 0
  const activeMilestone = goal.milestones.find(m => m.sprint_status === 'active')
  const isGenerating = goal.milestones.some(m => m.sprint_status === 'generating')

  function handleToggleTask(taskId: string, done: boolean) {
    if (done) return // real backend has no "uncomplete" affordance in this view
    mutations.completeTask(taskId)
  }

  function handleAbandon() {
    if (goal.status === 'abandoned') {
      mutations.changeStatus(goal.id, 'active')
    } else {
      mutations.changeStatus(goal.id, 'abandoned')
      setConfirm(null)
    }
  }

  function handleDelete() {
    mutations.deleteGoal(goal.id)
    setConfirm(null)
  }

  async function handleCompleteSprint() {
    if (!activeMilestone || completingSprint) return
    setCompletingSprint(true)
    try {
      await mutations.completeMilestone(goal.id, activeMilestone.id)
    } finally {
      setCompletingSprint(false)
    }
  }

  function handleRetryGeneration() {
    const failed = goal.milestones.find(m => m.sprint_status === 'failed')
    if (failed) mutations.retrySprintGeneration(goal.id, failed.id)
  }

  return (
    <Reveal className={cx('gf-card gf-gc', goal.status === 'abandoned' && 'is-abandoned')} delay={index * 70} style={{ boxShadow: ratio > 0 ? `0 0 ${14 + ratio * 16}px rgba(52,211,153,${(0.07 + ratio * 0.1).toFixed(2)})` : undefined }}>
      <button className="gf-gc-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <PuffyStar brightness={view.brightness} dying={view.isDying} />
        <div className="gf-gc-mid">
          <div className="gf-gc-badges">
            {isGenerating
              ? <span className="gf-chip gf-chip-muted">generating…</span>
              : <span className={cx('gf-chip', `t-${view.goal_type}`)}>{view.goal_type}</span>}
            {doneToday && <span className="gf-chip gf-chip-ok"><Icon name="check" size={10} stroke={3} /> done today</span>}
            {view.streak > 0 && <span className="gf-chip gf-chip-flame"><Icon name="flame" size={10} /> {view.streak}d</span>}
            {view.streak === 0 && view.lastStreak > 0 && <span className="gf-chip gf-chip-muted">last: {view.lastStreak}d</span>}
            <span className={cx('gf-chip', view.deadlineKind === 'over' ? 'gf-chip-over' : view.deadlineKind === 'soon' ? 'gf-chip-soon' : 'gf-chip-muted')}>{view.deadline}</span>
          </div>
          <h3 className="gf-gc-title">{view.smart_title}</h3>
        </div>
        <span className={cx('gf-gc-chev', open && 'is-open')}><Icon name="chevron" size={16} stroke={2.4} /></span>
      </button>

      <div className={cx('gf-gc-collapse', open && 'is-open')}>
        <div>
          <div className="gf-gc-tabs">
            <div className="gf-gc-tabind" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
            {(['today', 'sprints', 'history'] as const).map(t => (
              <button key={t} className={cx('gf-gc-tab', tab === t && 'is-on')} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="gf-gc-body" key={tab}>
            {tab === 'today' && (
              <TodayTab
                goal={goal}
                onToggleTask={handleToggleTask}
                onRestoreTask={onRestoreTask}
                onSaveEdit={(taskId, description) => { void mutations.saveEdit(taskId, description).catch(() => { /* toast via onError */ }) }}
                onRegenerate={mutations.regenerateTask}
                onReorder={(positions) => mutations.reorderTasks(goal.id, positions)}
                onAddTask={(description) => { void mutations.addTask(goal.id, null, description).catch(() => { /* toast via onError */ }) }}
                onTriggerRescue={() => mutations.triggerRescue(goal.id)}
                triggeringRescue={mutations.isTriggeringRescue}
                onAbandon={handleAbandon}
                onDelete={handleDelete}
                onCompleteSprint={handleCompleteSprint}
                onRetryGeneration={handleRetryGeneration}
                completingSprint={completingSprint}
                retryingGeneration={mutations.isRetryingSprintGeneration}
                confirm={confirm}
                setConfirm={setConfirm}
              />
            )}
            {tab === 'sprints' && <SprintsTab goal={goal} />}
            {tab === 'history' && <HistoryTab goal={goal} />}
          </div>
        </div>
      </div>
    </Reveal>
  )
}
