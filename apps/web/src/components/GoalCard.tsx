import { useState, useEffect, useRef } from 'react'
import { Circle, CheckCircle2, Pencil } from 'lucide-react'
import { T } from '../lib/theme'
import { todayStr, streak, starBrightness } from '../lib/gamification'
import { StarIcon, Heatmap } from './GamificationSvgs'
import Badge from './ui/Badge'
import Btn from './ui/Btn'
import type { Goal, Task } from '../lib/types'

export interface GoalCardProps {
  goal: Goal
  editingTaskId: string | null
  editingText: string
  setEditingText: (t: string) => void
  onCompleteTask:       (taskId: string) => void
  onStartEdit:          (task: Task) => void
  onCancelEdit:         () => void
  onSaveEdit:           (taskId: string, original: string) => void
  onDeleteGoal:         (goalId: string) => void
  onStatusChange:       (goalId: string, status: 'active' | 'achieved' | 'abandoned') => void
  onCompleteMilestone:  (goalId: string, milestoneId: string) => Promise<void>
}

export default function GoalCard({
  goal, editingTaskId, editingText,
  setEditingText,
  onCompleteTask, onStartEdit, onCancelEdit, onSaveEdit,
  onDeleteGoal, onStatusChange, onCompleteMilestone,
}: GoalCardProps) {
  const [open, setOpen] = useState(false)
  const [completingMilestone, setCompletingMilestone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const deleteTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
    }
  }, [])

  function handleDeleteClick() {
    if (confirmDelete) {
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
      setConfirmDelete(false)
      setConfirmAbandon(false)
      onDeleteGoal(goal.id)
    } else {
      setConfirmDelete(true)
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  function handleAbandonClick() {
    if (confirmAbandon) {
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current)
      if (deleteTimerRef.current)  clearTimeout(deleteTimerRef.current)
      setConfirmAbandon(false)
      setConfirmDelete(false)
      onStatusChange(goal.id, 'abandoned')
    } else {
      setConfirmAbandon(true)
      abandonTimerRef.current = setTimeout(() => setConfirmAbandon(false), 3000)
    }
  }

  // Milestone-gated computed values
  const activeMilestone      = goal.milestones.find(m => m.sprint_status === 'active')
  const nextMilestone        = activeMilestone ? goal.milestones.find(m => m.position === activeMilestone.position + 1) : undefined
  const currentSprintTasks   = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone   = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const milestonesProgress   = goal.milestones_total > 0 ? Math.round((goal.milestones_completed / goal.milestones_total) * 100) : 0

  const todayTasks  = goal.daily_tasks.filter(t => t.assigned_date === todayStr())
  const doneToday   = todayTasks.length > 0 && todayTasks.every(t => t.is_completed)
  const s           = streak(goal.completed_days)
  const b           = goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved  = goal.status === 'achieved'

  const nowMs = new Date().getTime()
  const days  = Math.round((new Date(goal.target_date).getTime() - nowMs) / 864e5)
  const dl    = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d left`

  return (
    <div style={{
      background: T.card, borderRadius: 14, overflow: 'hidden', marginBottom: 1,
      border: `1px solid ${isAbandoned ? T.dim + '40' : open ? T.borderHi : T.border}`,
      opacity: isAbandoned ? 0.5 : 1,
    }}>

      {/* ── Header row (click to expand) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${goal.smart_title} — click to ${open ? 'collapse' : 'expand'}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
      >
        <StarIcon b={b} size={52} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <Badge color={T.indigo}>{goal.goal_type}</Badge>
            {isAbandoned  && <Badge color={T.muted}>abandoned</Badge>}
            {isAchieved   && <Badge color={T.amber}>✦ achieved</Badge>}
            {doneToday && !isAbandoned && !isAchieved && <Badge color={T.emerald}>✓ done today</Badge>}
            {s > 0 && !isAbandoned && <Badge color={T.amber}>{s}d streak</Badge>}
            {goal.target_date && <Badge color={days < 0 ? T.rose : T.muted}>{dl}</Badge>}
          </div>
          <div style={{ fontSize: 15, color: isAbandoned ? T.muted : T.text, fontFamily: T.serif, lineHeight: 1.45, marginBottom: 3 }}>
            {goal.smart_title}
          </div>
          <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 3 }}>
            {goal.smart_description}
          </div>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>"{goal.raw_input}"</div>
        </div>

        <span style={{ color: T.dim, fontSize: 15, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          ▾
        </span>
      </div>

      {/* ── Sprint Rail ── */}
      {!isAbandoned && !isAchieved && goal.milestones.length > 0 && (
        <div style={{ margin: '0 18px 12px', padding: '10px 14px', background: `${T.indigo}08`, borderRadius: 9, border: `1px solid ${T.indigo}20` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: T.indigo, fontFamily: T.mono, letterSpacing: '0.1em', flexShrink: 0 }}>
              SPRINT {activeMilestone?.position ?? '—'} OF {goal.milestones_total}
            </span>
            {activeMilestone?.sprint_status === 'generating' ? (
              <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: 'pulse 1.5s ease-in-out infinite' }}>
                ◉ AI forging next sprint···
              </span>
            ) : activeMilestone ? (
              <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>— {activeMilestone.title}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {goal.milestones.flatMap((m, i) => {
              const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
              const dot = (
                <div key={m.id} style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontFamily: T.mono,
                  background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : `${T.dim}15`,
                  border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : `1.5px solid ${T.dim}`,
                  color: m.is_completed ? T.emerald : isActive ? T.indigo : T.muted,
                }}>
                  {m.is_completed ? '✓' : m.position}
                </div>
              )
              if (i === 0) return [dot]
              const line = (
                <div key={`line-${i}`} style={{
                  flex: 1, height: 1, minWidth: 8,
                  background: m.is_completed ? T.emerald : i <= (activeMilestone?.position ?? 1) - 1 ? T.indigo : T.dim,
                  opacity: 0.35,
                }} />
              )
              return [line, dot]
            })}
          </div>
        </div>
      )}

      {/* ── Abandoned banner ── */}
      {isAbandoned && (
        <div style={{ margin: '0 18px 14px', padding: '11px 14px', background: T.dim + '25', borderRadius: 9, border: `1px solid ${T.dim}40` }}>
          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginBottom: 8 }}>
            ✦ Star faded — goal abandoned.
          </div>
          <Btn onClick={() => onStatusChange(goal.id, 'active')} variant="ghost" small>Revive goal</Btn>
        </div>
      )}

      {/* ── Achieved banner ── */}
      {isAchieved && (
        <div style={{ margin: '0 18px 14px', padding: '11px 14px', background: T.amber + '10', borderRadius: 9, border: `1px solid ${T.amber}40` }}>
          <div style={{ fontSize: 12, color: T.amber, fontFamily: T.mono }}>
            🏆 Goal achieved — it lives in your Hall of Fame.
          </div>
        </div>
      )}

      {/* ── Today's tasks ── */}
      {!isAbandoned && !isAchieved && todayTasks.length > 0 && (
        <div style={{ margin: '0 18px 14px', padding: '13px 15px', background: T.surface, borderRadius: 9, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>
            TODAY'S TASKS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayTasks.map(task => {
              const isEditing = editingTaskId === task.id
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                  className="group">

                  {/* Complete toggle */}
                  <button
                    aria-label={task.is_completed ? 'Task completed' : 'Mark task complete'}
                    aria-pressed={task.is_completed}
                    disabled={task.is_completed || isEditing}
                    onClick={() => !task.is_completed && !isEditing && onCompleteTask(task.id)}
                    style={{
                      marginTop: 1, flexShrink: 0, background: 'none', border: 'none', padding: 0,
                      cursor: !task.is_completed && !isEditing ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {task.is_completed
                      ? <CheckCircle2 size={16} color={T.emerald} />
                      : <Circle size={16} color={T.dim} />
                    }
                  </button>

                  {/* Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={() => onSaveEdit(task.id, task.description)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  onSaveEdit(task.id, task.description)
                          if (e.key === 'Escape') onCancelEdit()
                        }}
                        style={{
                          width: '100%', fontSize: 13, background: T.surface,
                          border: `1px solid ${T.orange}80`, borderRadius: 5,
                          padding: '2px 7px', color: T.text, outline: 'none', fontFamily: T.mono,
                        }}
                      />
                    ) : (
                      <>
                        <p style={{
                          fontSize: 13, color: task.is_completed ? T.dim : T.text,
                          textDecoration: task.is_completed ? 'line-through' : 'none',
                          lineHeight: 1.5, fontFamily: T.mono, margin: 0,
                        }}>
                          {task.description}
                        </p>
                        {!task.is_completed && task.tip && (
                          <p style={{ fontSize: 11, color: T.orange, fontFamily: T.mono, fontStyle: 'italic', margin: '2px 0 0' }}>
                            "{task.tip}"
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Action icons — pending tasks only */}
                  {!task.is_completed && !isEditing && (
                    <div className="flex items-center shrink-0 transition-opacity opacity-50 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => onStartEdit(task)}
                        aria-label="Edit task"
                        className="text-[#3f3f5c] hover:text-indigo-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
                        style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Status actions ── */}
      {!isAbandoned && !isAchieved && (
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          {allMilestonesComplete ? (
            <button
              onClick={() => onStatusChange(goal.id, 'achieved')}
              style={{
                cursor: 'pointer', padding: '5px 14px', borderRadius: 8,
                fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                background: `${T.amber}20`, color: T.amber, border: `1px solid ${T.amber}60`,
                boxShadow: `0 0 14px ${T.amber}50`,
              }}
            >
              ✦ Ascend to Achieved
            </button>
          ) : allSprintTasksDone && activeMilestone ? (
            <button
              onClick={async () => {
                setCompletingMilestone(true)
                await onCompleteMilestone(goal.id, activeMilestone.id)
                setCompletingMilestone(false)
              }}
              disabled={completingMilestone}
              style={{
                cursor: completingMilestone ? 'default' : 'pointer',
                padding: '5px 14px', borderRadius: 8,
                fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                background: `${T.indigo}20`, color: T.indigo, border: `1px solid ${T.indigo}55`,
                boxShadow: `0 0 12px ${T.indigo}35`, opacity: completingMilestone ? 0.6 : 1,
              }}
            >
              {completingMilestone
                ? '···'
                : `✦ Complete Sprint → ${nextMilestone ? 'Start ' + nextMilestone.title : 'Final Lap'}`}
            </button>
          ) : doneToday ? (
            <span style={{
              padding: '5px 12px', borderRadius: 8, fontFamily: T.mono, fontSize: 11,
              background: `${T.emerald}15`, color: T.emerald, border: `1px solid ${T.emerald}40`,
              letterSpacing: '0.04em',
            }}>
              ✓ Today's Work Done
            </span>
          ) : null}
          <button
            onClick={handleAbandonClick}
            aria-label={confirmAbandon ? 'Confirm abandon goal' : 'Abandon goal'}
            style={{
              cursor: 'pointer', minHeight: 44, minWidth: 44,
              padding: '9px 14px', borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
              background: confirmAbandon ? `${T.amber}15` : 'transparent',
              color: confirmAbandon ? T.amber : T.muted,
              border: confirmAbandon ? `1px solid ${T.amber}60` : `1px solid ${T.border}`,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {confirmAbandon ? 'Sure? Abandon' : '✕ Abandon'}
          </button>
          <button
            onClick={handleDeleteClick}
            aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'}
            style={{
              cursor: 'pointer', minHeight: 44, minWidth: 44,
              padding: '9px 14px', borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
              background: confirmDelete ? `${T.rose}25` : 'transparent',
              color: T.rose,
              border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {confirmDelete ? 'Sure? Delete' : 'Delete'}
          </button>
        </div>
      )}
      {(isAbandoned || isAchieved) && (
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7 }}>
          {isAbandoned && <Btn onClick={() => onStatusChange(goal.id, 'active')} variant="ghost" small>▶ Revive</Btn>}
          <button
            onClick={handleDeleteClick}
            aria-label={confirmDelete ? 'Confirm delete goal' : 'Delete goal'}
            style={{
              cursor: 'pointer', minHeight: 44, minWidth: 44,
              padding: '9px 14px', borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
              background: confirmDelete ? `${T.rose}25` : 'transparent',
              color: T.rose,
              border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {confirmDelete ? 'Sure? Delete' : 'Delete'}
          </button>
        </div>
      )}

      {/* ── Expanded section ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: 18 }}>

          {/* Star brightness */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 7 }}>
              STAR BRIGHTNESS — {Math.round(b * 100)}%
            </div>
            <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: b > 0.6 ? 'hsl(42,100%,60%)' : b > 0.3 ? T.orange : T.muted,
                width: `${b * 100}%`, transition: 'width 0.7s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>
              {b > 0.8 ? 'Blazing — keep it up!' : b > 0.6 ? 'Glowing strong' : b > 0.4 ? 'Flickering — stay consistent' : b > 0.2 ? 'Fading — come back!' : 'Almost out'}
            </div>
          </div>

          {/* Milestones */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>MILESTONES</div>
            {goal.milestones.map(m => {
              const isActive = m.sprint_status === 'active' || m.sprint_status === 'generating'
              return (
                <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 7 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontFamily: T.mono,
                    background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : `${T.dim}15`,
                    border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : `1.5px solid ${T.dim}`,
                    color: m.is_completed ? T.emerald : isActive ? T.indigo : T.muted,
                  }}>
                    {m.is_completed ? '✓' : m.position}
                  </div>
                  <span style={{ fontSize: 12, color: m.is_completed ? T.emerald : isActive ? T.text : T.textDim, flex: 1 }}>
                    {m.title}
                  </span>
                  {m.sprint_status === 'generating' && (
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: 'pulse 1.5s ease-in-out infinite' }}>
                      generating···
                    </span>
                  )}
                  {m.sprint_status === 'ready' && (
                    <span style={{ fontSize: 10, color: T.indigo, fontFamily: T.mono }}>ready</span>
                  )}
                  {m.is_completed && (
                    <span style={{ fontSize: 10, color: T.emerald, fontFamily: T.mono }}>done</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress — milestone-gated */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 7 }}>
              PROGRESS — {milestonesProgress}%
            </div>
            <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: milestonesProgress === 100 ? T.amber : T.orange,
                width: `${milestonesProgress}%`, transition: 'width 0.7s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>
              {goal.milestones_completed} of {goal.milestones_total} sprints completed
            </div>
          </div>

          {/* Heatmap */}
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>
              COMPLETION HISTORY — {goal.completed_days.length} days
            </div>
            <Heatmap days={goal.completed_days} />
          </div>
        </div>
      )}
    </div>
  )
}
