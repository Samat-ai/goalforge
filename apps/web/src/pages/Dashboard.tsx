import { useState, useEffect, useRef } from 'react'
import { useUser, useAuth } from '@clerk/react'
import { Circle, CheckCircle2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import api, { setAuthToken } from '../lib/api'
import AppHeader from '../components/AppHeader'
import { StarIcon, Heatmap, Creature } from '../components/GamificationSvgs'
import { todayStr, streak, starBrightness } from '../lib/gamification'
import { T } from '../lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string
  goal_id: string
  milestone_id: string | null
  description: string
  tip: string
  assigned_date: string
  is_completed: boolean
  completed_at: string | null
}

interface Milestone {
  id: string
  goal_id: string
  title: string
  position: number
  is_final: boolean
  sprint_theme: string
  sprint_status: 'pending' | 'generating' | 'ready' | 'active' | 'completed' | 'failed'
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

interface Goal {
  id: string
  user_id: string
  raw_input: string
  smart_title: string
  smart_description: string
  goal_type: string
  target_date: string
  milestones: Milestone[]
  milestones_completed: number
  milestones_total: number
  status: 'active' | 'achieved' | 'abandoned'
  current_streak: number
  best_streak: number
  vitality: number
  progress: number
  created_at: string
  daily_tasks: Task[]
  completed_days: string[]
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ children, color = T.orange }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20,
      fontFamily: T.mono, textTransform: "uppercase", letterSpacing: "0.07em",
      border: `1px solid ${color}50`, background: `${color}15`, color,
    }}>
      {children}
    </span>
  )
}

interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "ghost" | "danger" | "success"
  loading?: boolean
  small?: boolean
  disabled?: boolean
}
function Btn({ children, onClick, variant = "primary", loading = false, small = false, disabled = false }: BtnProps) {
  const V = {
    primary: { background: T.orange,           color: "#fff",      border: "none" },
    ghost:   { background: "transparent",      color: T.muted,     border: `1px solid ${T.border}` },
    danger:  { background: "transparent",      color: T.rose,      border: `1px solid ${T.rose}40` },
    success: { background: `${T.emerald}20`,   color: T.emerald,   border: `1px solid ${T.emerald}40` },
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        cursor: loading || disabled ? "default" : "pointer",
        padding: small ? "9px 14px" : "9px 18px",
        borderRadius: 8, fontFamily: T.mono, fontSize: small ? 11 : 12,
        fontWeight: 500, letterSpacing: "0.04em", opacity: disabled ? 0.4 : 1,
        ...V[variant],
      }}
    >
      {loading ? "···" : children}
    </button>
  )
}

// ── TodayBar ──────────────────────────────────────────────────────────────────
function TodayBar({ goals }: { goals: Goal[] }) {
  const active    = goals.filter(g => g.status === "active")
  const todayAll  = active.flatMap(g => g.daily_tasks.filter(t => t.assigned_date === todayStr()))
  const doneCnt   = todayAll.filter(t => t.is_completed).length
  if (!active.length || !todayAll.length) return null

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11,
      padding: "13px 17px", marginBottom: 19, display: "flex", alignItems: "center", gap: 15,
    }}>
      <div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginBottom: 2 }}>TODAY</div>
        <div style={{ fontFamily: T.serif, fontSize: 19, color: T.text }}>{doneCnt} / {todayAll.length} done</div>
      </div>
      <div style={{ flex: 1, height: 5, background: T.dim, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, background: T.orange,
          width: `${(doneCnt / todayAll.length) * 100}%`, transition: "width 0.5s",
        }} />
      </div>
      <span style={{ fontSize: 20 }}>{doneCnt === todayAll.length ? "🏆" : "🎯"}</span>
    </div>
  )
}

// ── AddGoal (inline form) ─────────────────────────────────────────────────────
function AddGoal({ onAdd, value, onChange }: {
  onAdd: (rawInput: string) => Promise<void>
  value: string
  onChange: (v: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<"idle" | "thinking" | "done">("idle")

  const submit = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setStatus("thinking")
    await onAdd(value.trim())
    setStatus("done")
    onChange("")
    setTimeout(() => { setStatus("idle"); setLoading(false) }, 700)
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.orange}55`, borderRadius: 13, padding: 18, marginBottom: 22 }}>
      <div style={{ fontSize: 10, color: T.orange, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 11 }}>
        DESCRIBE YOUR GOAL — AI WILL REFINE IT
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder="e.g. get better at leetcode, run a 5k, write a novel..."
        rows={3}
        style={{
          width: "100%", background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 7, padding: "11px 13px", color: T.text, fontFamily: T.mono,
          fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box",
        }}
      />
      {status === "thinking" && <div style={{ marginTop: 10, fontSize: 12, color: T.orange, fontFamily: T.mono }}>◉ AI is forging your plan···</div>}
      {status === "done"     && <div style={{ marginTop: 10, fontSize: 12, color: T.emerald, fontFamily: T.mono }}>✓ Goal added!</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
        <Btn onClick={submit} loading={loading}>Create Goal →</Btn>
      </div>
    </div>
  )
}

// ── GoalCard ──────────────────────────────────────────────────────────────────
interface GoalCardProps {
  goal: Goal
  editingTaskId: string | null
  editingText: string
  setEditingText: (t: string) => void
  onCompleteTask:    (taskId: string) => void
  onStartEdit:       (task: Task) => void
  onCancelEdit:      () => void
  onSaveEdit:        (taskId: string, original: string) => void
  onDeleteGoal:           (goalId: string) => void
  onStatusChange:         (goalId: string, status: 'active' | 'achieved' | 'abandoned') => void
  onCompleteMilestone:    (goalId: string, milestoneId: string) => Promise<void>
}

function GoalCard({
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
      onStatusChange(goal.id, "abandoned")
    } else {
      setConfirmAbandon(true)
      abandonTimerRef.current = setTimeout(() => setConfirmAbandon(false), 3000)
    }
  }

  // Milestone-gated computed values
  const activeMilestone      = goal.milestones.find(m => m.sprint_status === "active")
  const nextMilestone        = activeMilestone ? goal.milestones.find(m => m.position === activeMilestone.position + 1) : undefined
  const currentSprintTasks   = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone   = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const milestonesProgress   = goal.milestones_total > 0 ? Math.round((goal.milestones_completed / goal.milestones_total) * 100) : 0

  const todayTasks = goal.daily_tasks.filter(t => t.assigned_date === todayStr())
  const doneToday  = todayTasks.length > 0 && todayTasks.every(t => t.is_completed)
  const s          = streak(goal.completed_days)
  const b          = goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved  = goal.status === 'achieved'

  const nowMs = new Date().getTime()
  const days = Math.round((new Date(goal.target_date).getTime() - nowMs) / 864e5)
  const dl   = days < 0 ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : `${days}d left`

  return (
    <div style={{
      background: T.card, borderRadius: 14, overflow: "hidden", marginBottom: 1,
      border: `1px solid ${isAbandoned ? T.dim + "40" : open ? T.borderHi : T.border}`,
      opacity: isAbandoned ? 0.5 : 1,
    }}>

      {/* ── Header row (click to expand) ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: "16px 18px", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}
      >
        <StarIcon b={b} size={52} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
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

        <span style={{ color: T.dim, fontSize: 15, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          ▾
        </span>
      </div>

      {/* ── Sprint Rail ── */}
      {!isAbandoned && !isAchieved && goal.milestones.length > 0 && (
        <div style={{ margin: "0 18px 12px", padding: "10px 14px", background: `${T.indigo}08`, borderRadius: 9, border: `1px solid ${T.indigo}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: T.indigo, fontFamily: T.mono, letterSpacing: "0.1em", flexShrink: 0 }}>
              SPRINT {activeMilestone?.position ?? "—"} OF {goal.milestones_total}
            </span>
            {activeMilestone?.sprint_status === "generating" ? (
              <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: "pulse 1.5s ease-in-out infinite" }}>
                ◉ AI forging next sprint···
              </span>
            ) : activeMilestone ? (
              <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>— {activeMilestone.title}</span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {goal.milestones.flatMap((m, i) => {
              const isActive    = m.sprint_status === "active" || m.sprint_status === "generating"
              const dot = (
                <div key={m.id} style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontFamily: T.mono,
                  background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : `${T.dim}15`,
                  border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : `1.5px solid ${T.dim}`,
                  color: m.is_completed ? T.emerald : isActive ? T.indigo : T.muted,
                }}>
                  {m.is_completed ? "✓" : m.position}
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
        <div style={{ margin: "0 18px 14px", padding: "11px 14px", background: T.dim + "25", borderRadius: 9, border: `1px solid ${T.dim}40` }}>
          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginBottom: 8 }}>
            ✦ Star faded — goal abandoned.
          </div>
          <Btn onClick={() => onStatusChange(goal.id, "active")} variant="ghost" small>Revive goal</Btn>
        </div>
      )}

      {/* ── Achieved banner ── */}
      {isAchieved && (
        <div style={{ margin: "0 18px 14px", padding: "11px 14px", background: T.amber + "10", borderRadius: 9, border: `1px solid ${T.amber}40` }}>
          <div style={{ fontSize: 12, color: T.amber, fontFamily: T.mono }}>
            🏆 Goal achieved — it lives in your Hall of Fame.
          </div>
        </div>
      )}

      {/* ── Today's tasks ── */}
      {!isAbandoned && !isAchieved && todayTasks.length > 0 && (
        <div style={{ margin: "0 18px 14px", padding: "13px 15px", background: T.surface, borderRadius: 9, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 9 }}>
            TODAY'S TASKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayTasks.map(task => {
              const isEditing  = editingTaskId  === task.id
              return (
                <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                  className="group">

                  {/* Complete toggle */}
                  <span
                    style={{ marginTop: 1, flexShrink: 0, cursor: !task.is_completed && !isEditing ? "pointer" : "default" }}
                    onClick={() => !task.is_completed && !isEditing && onCompleteTask(task.id)}
                  >
                    {task.is_completed
                      ? <CheckCircle2 size={16} color={T.emerald} />
                      : <Circle size={16} color={T.dim} />
                    }
                  </span>

                  {/* Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={() => onSaveEdit(task.id, task.description)}
                        onKeyDown={e => {
                          if (e.key === "Enter")  onSaveEdit(task.id, task.description)
                          if (e.key === "Escape") onCancelEdit()
                        }}
                        style={{
                          width: "100%", fontSize: 13, background: T.surface,
                          border: `1px solid ${T.orange}80`, borderRadius: 5,
                          padding: "2px 7px", color: T.text, outline: "none", fontFamily: T.mono,
                        }}
                      />
                    ) : (
                      <>
                        <p style={{
                          fontSize: 13, color: task.is_completed ? T.dim : T.text,
                          textDecoration: task.is_completed ? "line-through" : "none",
                          lineHeight: 1.5, fontFamily: T.mono, margin: 0,
                        }}>
                          {task.description}
                        </p>
                        {!task.is_completed && task.tip && (
                          <p style={{ fontSize: 11, color: T.orange, fontFamily: T.mono, fontStyle: "italic", margin: "2px 0 0" }}>
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
                        className="text-[#3f3f5c] hover:text-indigo-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
                        style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Edit task"
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
        <div style={{ padding: "0 18px 14px", display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {allMilestonesComplete ? (
            <button
              onClick={() => onStatusChange(goal.id, "achieved")}
              style={{
                cursor: "pointer", padding: "5px 14px", borderRadius: 8,
                fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
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
                cursor: completingMilestone ? "default" : "pointer",
                padding: "5px 14px", borderRadius: 8,
                fontFamily: T.mono, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
                background: `${T.indigo}20`, color: T.indigo, border: `1px solid ${T.indigo}55`,
                boxShadow: `0 0 12px ${T.indigo}35`, opacity: completingMilestone ? 0.6 : 1,
              }}
            >
              {completingMilestone
                ? "···"
                : `✦ Complete Sprint → ${nextMilestone ? "Start " + nextMilestone.title : "Final Lap"}`}
            </button>
          ) : doneToday ? (
            <span style={{
              padding: "5px 12px", borderRadius: 8, fontFamily: T.mono, fontSize: 11,
              background: `${T.emerald}15`, color: T.emerald, border: `1px solid ${T.emerald}40`,
              letterSpacing: "0.04em",
            }}>
              ✓ Today's Work Done
            </span>
          ) : null}
          <button
            onClick={handleAbandonClick}
            style={{
              cursor: "pointer", minHeight: 44, minWidth: 44,
              padding: "9px 14px", borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
              background: confirmAbandon ? `${T.amber}15` : "transparent",
              color: confirmAbandon ? T.amber : T.muted,
              border: confirmAbandon ? `1px solid ${T.amber}60` : `1px solid ${T.border}`,
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
          >
            {confirmAbandon ? "Sure? Abandon" : "✕ Abandon"}
          </button>
          <button
            onClick={handleDeleteClick}
            style={{
              cursor: "pointer", minHeight: 44, minWidth: 44,
              padding: "9px 14px", borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
              background: confirmDelete ? `${T.rose}25` : "transparent",
              color: T.rose,
              border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {confirmDelete ? "Sure? Delete" : "Delete"}
          </button>
        </div>
      )}
      {(isAbandoned || isAchieved) && (
        <div style={{ padding: "0 18px 14px", display: "flex", gap: 7 }}>
          {isAbandoned && <Btn onClick={() => onStatusChange(goal.id, "active")} variant="ghost" small>▶ Revive</Btn>}
          <button
            onClick={handleDeleteClick}
            style={{
              cursor: "pointer", minHeight: 44, minWidth: 44,
              padding: "9px 14px", borderRadius: 8, fontFamily: T.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
              background: confirmDelete ? `${T.rose}25` : "transparent",
              color: T.rose,
              border: confirmDelete ? `1px solid ${T.rose}80` : `1px solid ${T.rose}40`,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {confirmDelete ? "Sure? Delete" : "Delete"}
          </button>
        </div>
      )}

      {/* ── Expanded section ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: 18 }}>

          {/* Star brightness */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 7 }}>
              STAR BRIGHTNESS — {Math.round(b * 100)}%
            </div>
            <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: b > 0.6 ? "hsl(42,100%,60%)" : b > 0.3 ? T.orange : T.muted,
                width: `${b * 100}%`, transition: "width 0.7s",
              }} />
            </div>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>
              {b > 0.8 ? "Blazing — keep it up!" : b > 0.6 ? "Glowing strong" : b > 0.4 ? "Flickering — stay consistent" : b > 0.2 ? "Fading — come back!" : "Almost out"}
            </div>
          </div>

          {/* Milestones */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 9 }}>MILESTONES</div>
            {goal.milestones.map(m => {
              const isActive = m.sprint_status === "active" || m.sprint_status === "generating"
              return (
                <div key={m.id} style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 7 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontFamily: T.mono,
                    background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : `${T.dim}15`,
                    border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : `1.5px solid ${T.dim}`,
                    color: m.is_completed ? T.emerald : isActive ? T.indigo : T.muted,
                  }}>
                    {m.is_completed ? "✓" : m.position}
                  </div>
                  <span style={{ fontSize: 12, color: m.is_completed ? T.emerald : isActive ? T.text : T.textDim, flex: 1 }}>
                    {m.title}
                  </span>
                  {m.sprint_status === "generating" && (
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: "pulse 1.5s ease-in-out infinite" }}>
                      generating···
                    </span>
                  )}
                  {m.sprint_status === "ready" && (
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
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 7 }}>
              PROGRESS — {milestonesProgress}%
            </div>
            <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: milestonesProgress === 100 ? T.amber : T.orange,
                width: `${milestonesProgress}%`, transition: "width 0.7s",
              }} />
            </div>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>
              {goal.milestones_completed} of {goal.milestones_total} sprints completed
            </div>
          </div>

          {/* Heatmap */}
          <div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 9 }}>
              COMPLETION HISTORY — {goal.completed_days.length} days
            </div>
            <Heatmap days={goal.completed_days} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── EmptyState (onboarding for new users) ─────────────────────────────────────
const EXAMPLE_GOALS = [
  "I want to learn Spanish basics in 3 months",
  "Get in shape — lose 10 lbs by summer",
  "Read 12 books this year",
]

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "40px 16px 32px",
      animation: "fadeUp 0.5s ease both",
    }}>
      <div style={{ marginBottom: 20, opacity: 0.85 }}>
        <Creature pts={0} size={96} />
      </div>
      <h2 style={{
        fontFamily: T.serif, fontSize: 22, fontWeight: 600,
        color: T.text, marginBottom: 10, lineHeight: 1.3,
      }}>
        Your journey starts here ✦
      </h2>
      <p style={{
        fontSize: 13, color: T.textDim, fontFamily: T.mono,
        maxWidth: 380, lineHeight: 1.7, marginBottom: 28,
      }}>
        Describe any goal in plain language. Our AI will turn it into a
        step-by-step plan with daily tasks.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 480 }}>
        {EXAMPLE_GOALS.map(text => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            style={{
              minHeight: 44, padding: "10px 16px", borderRadius: 22,
              fontFamily: T.mono, fontSize: 12, cursor: "pointer",
              background: `${T.indigo}12`, color: T.indigo,
              border: `1px solid ${T.indigo}35`,
              transition: "background 0.15s, border-color 0.15s",
              lineHeight: 1.4, textAlign: "left",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${T.indigo}22`
              e.currentTarget.style.borderColor = `${T.indigo}60`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${T.indigo}12`
              e.currentTarget.style.borderColor = `${T.indigo}35`
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard (main page) ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }     = useUser()
  const { getToken } = useAuth()

  const [goals,  setGoals]  = useState<Goal[]>([])
  const [pts,    setPts]    = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState<string>("all")
  const [addGoalText, setAddGoalText] = useState("")

  // Task edit state
  const [editingTaskId,  setEditingTaskId]  = useState<string | null>(null)
  const [editingText,    setEditingText]    = useState("")

  // ── Fetch goals + star_points ──
  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    let ignore = false

    async function load() {
      try {
        const token = await getToken()
        setAuthToken(token)
        const [goalsRes, profileRes] = await Promise.all([
          api.get<Goal[]>(`/users/${userId}/goals`),
          api.get<{ star_points: number }>(`/users/${userId}/profile`).catch(() => ({ data: { star_points: 0 } })),
        ])
        if (!ignore) {
          setGoals(goalsRes.data)
          setPts(profileRes.data.star_points)
        }
      } catch {
        if (!ignore) setError("Failed to load goals. Please refresh.")
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [user?.id, getToken])

  // ── Add Goal ──
  async function addGoal(rawInput: string) {
    try {
      const { data } = await api.post<Goal>(
        `/users/${user!.id}/goals`,
        { raw_input: rawInput },
      )
      setGoals(prev => [data, ...prev])
    } catch {
      toast.error("Could not create goal. Please try again.")
    }
  }

  // ── Complete task (optimistic) ──
  function completeTask(taskId: string) {
    const today = todayStr()
    setGoals(prev => prev.map(goal => {
      if (!goal.daily_tasks.some(t => t.id === taskId)) return goal
      return {
        ...goal,
        vitality:       Math.min(100, goal.vitality + 10),
        daily_tasks:    goal.daily_tasks.map(t => t.id === taskId ? { ...t, is_completed: true } : t),
        completed_days: goal.completed_days.includes(today) ? goal.completed_days : [...goal.completed_days, today],
      }
    }))
    setPts(p => p + 10)
    toast.success("Task completed! +10 pts", { icon: "⚡" })

    api.patch(`/tasks/${taskId}/complete`).catch(() => {
      setGoals(prev => prev.map(goal => {
        if (!goal.daily_tasks.some(t => t.id === taskId)) return goal
        // Only remove today from completed_days if no OTHER task for this goal was already completed today
        const otherTaskDoneToday = goal.daily_tasks.some(
          t => t.id !== taskId && t.is_completed && t.assigned_date === today
        )
        return {
          ...goal,
          vitality:    Math.max(0, goal.vitality - 10),
          daily_tasks: goal.daily_tasks.map(t => t.id === taskId ? { ...t, is_completed: false } : t),
          completed_days: otherTaskDoneToday
            ? goal.completed_days
            : goal.completed_days.filter(d => d !== today),
        }
      }))
      setPts(p => p - 10)
      toast.error("Could not save task. Please try again.")
    })
  }

  // ── Task edit ──
  function startEdit(task: Task) {
    setEditingTaskId(task.id)
    setEditingText(task.description)
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditingText("")
  }

  async function saveEdit(taskId: string, original: string) {
    const trimmed = editingText.trim()
    if (!trimmed || trimmed === original) { cancelEdit(); return }
    setGoals(prev => prev.map(g => ({
      ...g,
      daily_tasks: g.daily_tasks.map(t => t.id === taskId ? { ...t, description: trimmed } : t),
    })))
    cancelEdit()
    try {
      await api.patch(`/tasks/${taskId}`, { description: trimmed })
      toast.success("Task updated")
    } catch {
      setGoals(prev => prev.map(g => ({
        ...g,
        daily_tasks: g.daily_tasks.map(t => t.id === taskId ? { ...t, description: original } : t),
      })))
      toast.error("Could not update task.")
    }
  }

  // ── Delete goal ──
  async function deleteGoal(goalId: string) {
    const deleted = goals.find(g => g.id === goalId)
    setGoals(prev => prev.filter(g => g.id !== goalId))
    try {
      await api.delete(`/goals/${goalId}`)
      toast.success("Goal deleted")
    } catch {
      if (deleted) setGoals(prev => [...prev, deleted])
      toast.error("Could not delete goal.")
    }
  }

  // ── Complete sprint milestone ──
  async function completeMilestone(goalId: string, milestoneId: string) {
    try {
      const { data } = await api.post<Goal>(`/goals/${goalId}/milestones/${milestoneId}/complete`)
      setGoals(prev => prev.map(g => g.id === goalId ? data : g))
      toast.success("Sprint complete! Next sprint unlocked. ✦")
    } catch {
      toast.error("Could not complete sprint. Please try again.")
    }
  }

  // ── Status change ──
  async function changeStatus(goalId: string, newStatus: 'active' | 'achieved' | 'abandoned') {
    const prev_status = goals.find(g => g.id === goalId)?.status
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: newStatus } : g))
    if (newStatus === "achieved" && prev_status !== "achieved") {
      setPts(p => p + 100)
      toast.success("Goal achieved! +100 pts 🏆")
    }
    try {
      await api.patch(`/goals/${goalId}`, { status: newStatus })
    } catch {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: prev_status ?? "active" } : g))
      if (newStatus === "achieved" && prev_status !== "achieved") setPts(p => p - 100)
      toast.error("Could not update goal status.")
    }
  }

  const filtered = filter === "all" ? goals : goals.filter(g => g.status === filter)

  // ── Render ──
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
        textarea:focus { border-color: ${T.orange} !important; outline: none; }
        button:hover { opacity: 0.82; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        .filter-tabs::-webkit-scrollbar { display: none; }
        button:focus-visible, a:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <AppHeader pts={pts} />

      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Your Goals
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>
            {goals.filter(g => g.status === "active").length} active · {goals.length} total
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: "spin 0.75s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: "14px 18px", background: `${T.rose}10`, border: `1px solid ${T.rose}30`, borderRadius: 10, color: T.rose, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <TodayBar goals={goals} />
            <AddGoal onAdd={addGoal} value={addGoalText} onChange={setAddGoalText} />

            {goals.length === 0 ? (
              <EmptyState onSelect={setAddGoalText} />
            ) : (
              <>
                {/* Filter tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 18, overflowX: "auto", scrollbarWidth: "none" }} className="filter-tabs">
                  {(["all", "active", "achieved", "abandoned"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "7px 14px", fontFamily: T.mono, fontSize: 11,
                        letterSpacing: "0.06em", flexShrink: 0,
                        color: filter === f ? T.text : T.muted,
                        borderBottom: filter === f ? `2px solid ${T.orange}` : "2px solid transparent",
                      }}
                    >
                      {f} ({goals.filter(g => f === "all" ? true : g.status === f).length})
                    </button>
                  ))}
                </div>

                {/* Goal list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: "44px 0", color: T.muted, fontSize: 13 }}>
                      No goals here yet.
                    </div>
                  )}
                  {filtered.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      editingTaskId={editingTaskId}
                      editingText={editingText}
                      setEditingText={setEditingText}
                      onCompleteTask={completeTask}
                      onStartEdit={startEdit}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      onDeleteGoal={deleteGoal}
                      onStatusChange={changeStatus}
                      onCompleteMilestone={completeMilestone}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
