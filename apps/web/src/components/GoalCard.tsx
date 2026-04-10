import { useState, useEffect, useRef } from 'react'
import { T } from '../lib/theme'
import { todayStr, streak, starBrightness, lastStreakLength } from '../lib/gamification'
import { StarIcon } from './GamificationSvgs'
import Badge from './ui/Badge'
import Btn from './ui/Btn'
import SprintRail from './SprintRail'
import DailyTaskList from './DailyTaskList'
import GoalHeatmap from './GoalHeatmap'
import { useGoalMutations } from '../hooks'
import { useTaskRestoreMutation } from '../hooks/useEnergyMutations'
import GoalNotes from './GoalNotes'
import type { Goal, RewardDrop } from '../lib/types'

export interface GoalCardProps {
  goal: Goal
  onJackpot?: (drop: RewardDrop) => void
}

export default function GoalCard({ goal, onJackpot }: GoalCardProps) {
  const mutations = useGoalMutations(goal.user_id, onJackpot)
  const restoreTaskMutation = useTaskRestoreMutation(goal.user_id)

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
      mutations.deleteGoal(goal.id)
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
      mutations.changeStatus(goal.id, 'abandoned')
    } else {
      setConfirmAbandon(true)
      abandonTimerRef.current = setTimeout(() => setConfirmAbandon(false), 3000)
    }
  }

  // Milestone-gated computed values
  const activeMilestone      = goal.milestones.find(m => m.sprint_status === 'active')
  const failedMilestone      = goal.milestones.find(m => m.sprint_status === 'failed')
    ?? goal.milestones.find(m =>
      m.sprint_status === 'active' && !m.is_completed &&
      goal.daily_tasks.filter(t => t.milestone_id === m.id).length === 0
    )
  const nextMilestone        = activeMilestone ? goal.milestones.find(m => m.position === activeMilestone.position + 1) : undefined
  const currentSprintTasks   = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone   = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const milestonesProgress   = goal.milestones_total > 0 ? Math.round((goal.milestones_completed / goal.milestones_total) * 100) : 0

  const isGenerating = goal.milestones.some(m => m.sprint_status === 'generating')

  const isRescueMode = goal.rescue_mode && !isGenerating

  const DISMISS_KEY = `rescue_dismissed_${goal.id}`
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < 8 * 60 * 60 * 1000  // safe: runs in initializer, not render
  })

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  async function handleStartEasyMode() {
    if (mutations.isTriggeringRescue) return
    try {
      await mutations.triggerRescue(goal.id)
      handleDismiss()
    } catch {
      // Error toast is surfaced by the mutation's onError path.
    }
  }

  const todayTasks  = goal.daily_tasks
    .filter(t => t.assigned_date === todayStr())
    .sort((a, b) => a.position - b.position)
  const completedTodayCount = todayTasks.filter(t => t.is_completed).length
  const completionRatio = todayTasks.length > 0 ? completedTodayCount / todayTasks.length : 0
  const doneToday   = todayTasks.length > 0 && todayTasks.every(t => t.is_completed)
  const s           = streak(goal.completed_days)
  const lastStreak  = lastStreakLength(goal.completed_days)
  const b           = goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved  = goal.status === 'achieved'
  const today       = todayStr()
  const overdueTasks = activeMilestone
    ? goal.daily_tasks
        .filter(t => t.milestone_id === activeMilestone.id && !t.is_completed && t.assigned_date < today)
        .sort((x, y) => x.assigned_date.localeCompare(y.assigned_date) || x.position - y.position)
    : []

  const days  = Math.round((new Date(goal.target_date).getTime() - new Date(today).getTime()) / 864e5)
  const dl    = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d left`

  return (
    <div
      className={`goal-card-shell ${isAchieved ? 'goal-achieved' : ''}`}
      style={{
        background: T.card, borderRadius: 14, overflow: 'hidden', marginBottom: 1,
        border: `1px solid ${isAbandoned ? T.dim + '40' : open ? T.borderHi : T.border}`,
        boxShadow: completionRatio > 0 && !isAbandoned
          ? `0 0 ${Math.round(10 + completionRatio * 18)}px rgba(16,185,129,${(0.08 + completionRatio * 0.12).toFixed(2)})`
          : 'none',
        opacity: isAbandoned ? 0.5 : 1,
      }}
    >

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
            {!isGenerating && <Badge color={T.indigo}>{goal.goal_type}</Badge>}
            {isGenerating && <Badge color={T.muted}>generating…</Badge>}
            {isAbandoned  && <Badge color={T.muted}>abandoned</Badge>}
            {isAchieved   && <Badge color={T.amber}>✦ achieved</Badge>}
            {doneToday && !isAbandoned && !isAchieved && <Badge color={T.emerald}>✓ done today</Badge>}
            {s > 0 && !isAbandoned && <Badge color={T.amber}>{s}d streak</Badge>}
            {s === 0 && lastStreak >= 2 && !isAbandoned && !isAchieved && <Badge color={T.dim}>last streak: {lastStreak}d</Badge>}
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

      {/* ── Generating skeleton ── */}
      {isGenerating && (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{
            padding: '14px 16px',
            background: `${T.indigo}10`,
            borderRadius: 10,
            border: `1px solid ${T.indigo}30`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `${T.indigo}20`, border: `1.5px solid ${T.indigo}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, animation: 'pulse 1.5s ease-in-out infinite',
              color: T.indigo, flexShrink: 0,
            }}>✦</div>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, marginBottom: 3 }}>
                Building your plan…
              </div>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                AI is generating milestones and tasks — this takes a few seconds
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recovery Sprint card — replaces SprintRail + DailyTaskList ── */}
      {isRescueMode && !dismissed && !isAbandoned && !isAchieved && (
        <div style={{ padding: '0 18px 22px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#2d1f4e', border: '1px solid #5b21b6',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            color: T.amber, fontFamily: T.mono,
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            ✦ EASY MODE
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>
            Let's make today easy.
          </div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 18 }}>
            It looks like you've been busy. We paused your schedule and set up two quick wins
            for today — no pressure, no catching up.
          </div>
          <Btn
            variant="primary"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={handleStartEasyMode}
            disabled={mutations.isTriggeringRescue}
          >
            {mutations.isTriggeringRescue ? 'Starting easy mode…' : 'Start Easy Mode (2 min)'}
          </Btn>
          <button
            onClick={handleDismiss}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              fontSize: 12, color: T.muted, background: 'none', border: 'none',
              textDecoration: 'underline', cursor: 'pointer', padding: 4, minHeight: 44,
            }}
          >
            I'm feeling good — show my full plan
          </button>
        </div>
      )}

      {/* ── Sprint Rail ── */}
      {(!isRescueMode || dismissed) && !isGenerating && !isAbandoned && !isAchieved && goal.milestones.length > 0 && (
        <SprintRail
          milestones={goal.milestones}
          activeMilestone={activeMilestone}
          milestonesTotal={goal.milestones_total}
          failedMilestone={failedMilestone}
          onRetryGeneration={(milestoneId) => mutations.retrySprintGeneration(goal.id, milestoneId)}
          isRetrying={mutations.isRetryingSprintGeneration}
        />
      )}

      {/* ── Abandoned banner ── */}
      {isAbandoned && (
        <div style={{ margin: '0 18px 14px', padding: '11px 14px', background: T.dim + '25', borderRadius: 9, border: `1px solid ${T.dim}40` }}>
          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginBottom: 8 }}>
            ✦ Star faded — goal abandoned.
          </div>
          <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>Revive goal</Btn>
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
      {(!isRescueMode || dismissed) && !isGenerating && !isAbandoned && !isAchieved && (todayTasks.length > 0 || activeMilestone || overdueTasks.length > 0) && (
        <DailyTaskList
          goalId={goal.id}
          tasks={todayTasks}
          overdueTasks={overdueTasks}
          activeMilestoneId={activeMilestone?.id ?? null}
          onCompleteTask={mutations.completeTask}
          onSaveEdit={mutations.saveEdit}
          onAddTask={mutations.addTask}
          onRegenerateTask={mutations.regenerateTask}
          onReorderTasks={mutations.reorderTasks}
          onRestoreTask={(taskId) => new Promise<void>((resolve, reject) => {
            restoreTaskMutation.mutate(taskId, { onSuccess: () => resolve(), onError: reject })
          })}
        />
      )}

      {/* ── Goal Notes / Journal ── */}
      <GoalNotes goalId={goal.id} />

      {/* ── Status actions ── */}
      {!isGenerating && !isAbandoned && !isAchieved && (
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          {allMilestonesComplete ? (
            <button
              onClick={() => mutations.changeStatus(goal.id, 'achieved')}
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
                await mutations.completeMilestone(goal.id, activeMilestone.id)
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
          {isAbandoned && <Btn onClick={() => mutations.changeStatus(goal.id, 'active')} variant="ghost" small>▶ Revive</Btn>}
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
              const isFailed = m.sprint_status === 'failed'
              return (
                <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 7 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontFamily: T.mono,
                    background: m.is_completed ? `${T.emerald}20` : isActive ? `${T.indigo}25` : isFailed ? `${T.rose}20` : `${T.dim}15`,
                    border: m.is_completed ? `1.5px solid ${T.emerald}60` : isActive ? `1.5px solid ${T.indigo}70` : isFailed ? `1.5px solid ${T.rose}60` : `1.5px solid ${T.dim}`,
                    color: m.is_completed ? T.emerald : isActive ? T.indigo : isFailed ? T.rose : T.muted,
                  }}>
                    {m.is_completed ? '✓' : isFailed ? '✕' : m.position}
                  </div>
                  <span style={{ fontSize: 12, color: m.is_completed ? T.emerald : isActive ? T.text : isFailed ? T.rose : T.textDim, flex: 1 }}>
                    {m.title}
                  </span>
                  {m.sprint_status === 'generating' && (
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, animation: 'pulse 1.5s ease-in-out infinite' }}>
                      generating···
                    </span>
                  )}
                  {m.sprint_status === 'failed' && (
                    <span style={{ fontSize: 10, color: T.rose, fontFamily: T.mono }}>failed</span>
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
          <GoalHeatmap completedDays={goal.completed_days} />
        </div>
      )}
    </div>
  )
}
