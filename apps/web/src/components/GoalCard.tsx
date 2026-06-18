import { useState, useEffect, useRef } from 'react'
import { todayStr, streak, starBrightness, lastStreakLength } from '../lib/gamification'
import Icon from './ui/Icon'
import PuffyStar from './PuffyStar'
import MiniCalendar from './MiniCalendar'
import StreakBars from './StreakBars'
import DailyTaskList from './DailyTaskList'
import { useGoalMutations } from '../hooks'
import { useTaskRestoreMutation } from '../hooks/useEnergyMutations'
import type { Goal, RewardDrop, Milestone } from '../lib/types'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')
const CHIP_TYPES = ['fitness', 'career', 'learning', 'wellness']

export interface GoalCardProps {
  goal: Goal
  onJackpot?: (drop: RewardDrop) => void
}

function msStatusClass(m: Milestone): { dot: string; tag: string; label: string } {
  if (m.is_completed) return { dot: 'is-done', tag: 'is-done', label: 'done' }
  if (m.sprint_status === 'failed') return { dot: 'is-fail', tag: 'is-fail', label: 'failed' }
  if (m.sprint_status === 'active' || m.sprint_status === 'generating') return { dot: 'is-active', tag: 'is-active', label: m.sprint_status === 'generating' ? 'generating' : 'active' }
  if (m.sprint_status === 'ready') return { dot: 'is-active', tag: 'is-active', label: 'ready' }
  return { dot: '', tag: '', label: '' }
}

export default function GoalCard({ goal, onJackpot }: GoalCardProps) {
  const mutations = useGoalMutations(goal.user_id, onJackpot)
  const restoreTaskMutation = useTaskRestoreMutation(goal.user_id)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'today' | 'sprints' | 'history'>('today')
  const [histView, setHistView] = useState<'streaks' | 'calendar'>('streaks')
  const [completingMilestone, setCompletingMilestone] = useState(false)
  const [confirm, setConfirm] = useState<null | 'delete' | 'abandon'>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  function arm(kind: 'delete' | 'abandon', action: () => void) {
    if (confirm === kind) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      setConfirm(null)
      action()
    } else {
      setConfirm(kind)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirm(null), 3000)
    }
  }

  // ── Milestone-gated computed values ──
  const activeMilestone = goal.milestones.find(m => m.sprint_status === 'active')
  const nextMilestone = activeMilestone ? goal.milestones.find(m => m.position === activeMilestone.position + 1) : undefined
  const currentSprintTasks = activeMilestone ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id) : []
  const allSprintTasksDone = currentSprintTasks.length > 0 && currentSprintTasks.every(t => t.is_completed)
  const allMilestonesComplete = goal.milestones.length > 0 && goal.milestones.every(m => m.is_completed)
  const milestonesProgress = goal.milestones_total > 0 ? Math.round((goal.milestones_completed / goal.milestones_total) * 100) : 0
  const isGenerating = goal.milestones.some(m => m.sprint_status === 'generating')
  const isRescueMode = goal.rescue_mode && !isGenerating

  const DISMISS_KEY = `rescue_dismissed_${goal.id}`
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY)
    return !!ts && Date.now() - Number(ts) < 8 * 60 * 60 * 1000
  })
  const handleDismiss = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setDismissed(true) }
  async function handleStartEasyMode() {
    if (mutations.isTriggeringRescue) return
    try { await mutations.triggerRescue(goal.id); handleDismiss() } catch { /* toast handled in mutation */ }
  }

  const today = todayStr()
  const todayTasks = goal.daily_tasks.filter(t => t.assigned_date === today).sort((a, b) => a.position - b.position)
  const doneToday = todayTasks.length > 0 && todayTasks.every(t => t.is_completed)
  const completionRatio = todayTasks.length > 0 ? todayTasks.filter(t => t.is_completed).length / todayTasks.length : 0
  const s = streak(goal.completed_days)
  const lastStreak = lastStreakLength(goal.completed_days)
  const b = goal.status === 'achieved' ? 1 : starBrightness(goal.completed_days)
  const isAbandoned = goal.status === 'abandoned'
  const isAchieved = goal.status === 'achieved'
  const overdueTasks = activeMilestone
    ? goal.daily_tasks.filter(t => t.milestone_id === activeMilestone.id && !t.is_completed && t.assigned_date < today)
        .sort((x, y) => x.assigned_date.localeCompare(y.assigned_date) || x.position - y.position)
    : []

  const days = Math.round((new Date(goal.target_date).getTime() - new Date(today).getTime()) / 864e5)
  const deadline = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d left`
  const deadlineChip = days < 0 ? 'gf-chip-over' : days <= 3 ? 'gf-chip-soon' : 'gf-chip-muted'
  const typeChip = CHIP_TYPES.includes(goal.goal_type) ? `t-${goal.goal_type}` : 'gf-chip-muted'

  const tabIndex = { today: 0, sprints: 1, history: 2 }[tab]
  const bMsg = b < 0.3 ? 'Almost out — complete tasks to recharge' : b < 0.6 ? 'Fading — keep going' : 'Burning bright'

  return (
    <div
      className={cx('gf-card gf-gc goal-card-shell', isAchieved && 'goal-achieved')}
      style={{
        opacity: isAbandoned ? 0.55 : 1,
        boxShadow: completionRatio > 0 && !isAbandoned
          ? `0 0 ${Math.round(14 + completionRatio * 16)}px color-mix(in oklab, var(--ring-2) ${Math.round(8 + completionRatio * 12)}%, transparent)`
          : undefined,
      }}
    >
      <button className="gf-gc-head" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`${goal.smart_title} — ${open ? 'collapse' : 'expand'}`}>
        <PuffyStar brightness={b} />
        <div className="gf-gc-mid">
          <div className="gf-gc-badges">
            {!isGenerating && <span className={cx('gf-chip', typeChip)}>{goal.goal_type}</span>}
            {isGenerating && <span className="gf-chip gf-chip-muted">generating…</span>}
            {isAbandoned && <span className="gf-chip gf-chip-muted">abandoned</span>}
            {isAchieved && <span className="gf-chip gf-chip-flame"><Icon name="trophy" size={10} /> achieved</span>}
            {doneToday && !isAbandoned && !isAchieved && <span className="gf-chip gf-chip-ok"><Icon name="check" size={10} stroke={3} /> done today</span>}
            {s > 0 && !isAbandoned && <span className="gf-chip gf-chip-flame"><Icon name="flame" size={10} /> {s}d</span>}
            {s === 0 && lastStreak >= 2 && !isAbandoned && !isAchieved && <span className="gf-chip gf-chip-muted">last: {lastStreak}d</span>}
            {goal.target_date && <span className={cx('gf-chip', deadlineChip)}>{deadline}</span>}
          </div>
          <h3 className="gf-gc-title">{goal.smart_title}</h3>
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
            {/* ── TODAY ── */}
            {tab === 'today' && (
              <div className="gf-tabpane">
                {isGenerating ? (
                  <div className="gf-ov-sub" style={{ textAlign: 'center', padding: '12px 0' }}>✦ AI is generating your milestones and tasks — this takes a few seconds.</div>
                ) : isRescueMode && !dismissed ? (
                  <div>
                    <div className="gf-nudge-kicker">✦ Easy mode</div>
                    <h4 className="gf-nudge-title" style={{ marginBottom: 6 }}>Let's make today easy.</h4>
                    <p className="gf-ov-sub" style={{ fontSize: 13, marginBottom: 14 }}>We paused your schedule and set up two quick wins for today — no pressure, no catching up.</p>
                    <div className="gf-gc-actions">
                      <button className="gf-btn-pill is-sprint" onClick={() => { void handleStartEasyMode() }} disabled={mutations.isTriggeringRescue}>
                        {mutations.isTriggeringRescue ? 'Starting…' : 'Start Easy Mode (2 min)'}
                      </button>
                      <button className="gf-btn-pill" onClick={handleDismiss}>Show full plan</button>
                    </div>
                  </div>
                ) : isAbandoned ? (
                  <div className="gf-gc-actions">
                    <span className="gf-gc-hint">✦ Star faded — goal abandoned.</span>
                    <button className="gf-btn-pill is-sprint" onClick={() => mutations.changeStatus(goal.id, 'active')}>Revive goal</button>
                    <button className={cx('gf-btn-pill is-danger', confirm === 'delete' && 'is-armed')} onClick={() => arm('delete', () => mutations.deleteGoal(goal.id))}>{confirm === 'delete' ? 'Sure? Delete' : 'Delete'}</button>
                  </div>
                ) : isAchieved ? (
                  <div className="gf-gc-actions"><span className="gf-gc-hint">🏆 Goal achieved — it lives in your Hall of Fame.</span></div>
                ) : (
                  <>
                    {todayTasks.length > 0 && (
                      <div className="gf-mini">
                        <div className="gf-mini-track"><div className="gf-mini-fill" style={{ width: `${completionRatio * 100}%` }} /></div>
                        <span className="gf-mini-c">{todayTasks.filter(t => t.is_completed).length}/{todayTasks.length} tasks</span>
                      </div>
                    )}
                    {(todayTasks.length > 0 || overdueTasks.length > 0 || activeMilestone) && (
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
                    <div className="gf-gc-actions">
                      {allMilestonesComplete ? (
                        <button className="gf-btn-pill is-sprint" onClick={() => mutations.changeStatus(goal.id, 'achieved')}><Icon name="spark" size={12} /> Ascend to Achieved</button>
                      ) : allSprintTasksDone && activeMilestone ? (
                        <button
                          className="gf-btn-pill is-sprint"
                          disabled={completingMilestone}
                          onClick={async () => { setCompletingMilestone(true); await mutations.completeMilestone(goal.id, activeMilestone.id); setCompletingMilestone(false) }}
                        >
                          <Icon name="spark" size={12} /> {completingMilestone ? 'Completing…' : `Complete Sprint → ${nextMilestone ? nextMilestone.title : 'Final Lap'}`}
                        </button>
                      ) : (
                        <span className="gf-gc-hint">{Math.max(0, todayTasks.length - todayTasks.filter(t => t.is_completed).length)} task{todayTasks.length - todayTasks.filter(t => t.is_completed).length === 1 ? '' : 's'} left today</span>
                      )}
                      <button className={cx('gf-btn-pill is-warn', confirm === 'abandon' && 'is-armed')} onClick={() => arm('abandon', () => mutations.changeStatus(goal.id, 'abandoned'))}>{confirm === 'abandon' ? 'Sure? Abandon' : 'Abandon'}</button>
                      <button className={cx('gf-btn-pill is-danger', confirm === 'delete' && 'is-armed')} onClick={() => arm('delete', () => mutations.deleteGoal(goal.id))}>{confirm === 'delete' ? 'Sure? Delete' : 'Delete'}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── SPRINTS ── */}
            {tab === 'sprints' && (
              <div className="gf-tabpane">
                <div>
                  <div className="gf-ov-top"><span className="gf-cap2">Overall progress</span><span className="gf-ov-pct">{milestonesProgress}%</span></div>
                  <div className="gf-bar"><div className="gf-bar-fill" style={{ width: `${milestonesProgress}%` }} /></div>
                  <div className="gf-ov-sub">{goal.milestones_completed} of {goal.milestones_total} sprints completed</div>
                </div>
                <div>
                  <div className="gf-cap2" style={{ marginBottom: 10 }}>Milestones</div>
                  <div className="gf-ms-list">
                    {goal.milestones.map(m => {
                      const st = msStatusClass(m)
                      return (
                        <div key={m.id} className="gf-ms">
                          <span className={cx('gf-ms-dot', st.dot)}>{m.is_completed ? <Icon name="check" size={11} stroke={3} /> : m.sprint_status === 'failed' ? '×' : m.position}</span>
                          <span className={cx('gf-ms-title', st.dot)}>{m.title}</span>
                          {m.sprint_status === 'failed'
                            ? <button className="gf-btn-pill is-danger" style={{ height: 26 }} disabled={mutations.isRetryingSprintGeneration} onClick={() => mutations.retrySprintGeneration(goal.id, m.id)}>{mutations.isRetryingSprintGeneration ? '···' : 'Retry'}</button>
                            : st.label && <span className={cx('gf-ms-tag', st.tag)}>{st.label}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── HISTORY ── */}
            {tab === 'history' && (
              <div className="gf-tabpane">
                <div>
                  <div className="gf-hh"><span className="gf-cap2">Star brightness</span><span className="gf-hh-r">{Math.round(b * 100)}%</span></div>
                  <div className="gf-bar gf-bar-gold"><div className="gf-bar-fill" style={{ width: `${b * 100}%` }} /></div>
                  <div className="gf-ov-sub" style={{ marginTop: 5 }}>{bMsg}</div>
                </div>
                <div>
                  <div className="gf-hh">
                    <span className="gf-cap2">Completion history <span className="gf-hh-dim">{goal.completed_days.length} days</span></span>
                    <div className="gf-toggle">
                      {(['calendar', 'streaks'] as const).map(v => (
                        <button key={v} className={cx('gf-toggle-b', histView === v && 'is-on')} onClick={() => setHistView(v)}>{v === 'calendar' ? 'weeks' : 'streaks'}</button>
                      ))}
                    </div>
                  </div>
                  {histView === 'calendar' ? <MiniCalendar days={goal.completed_days} /> : <StreakBars days={goal.completed_days} />}
                </div>
                <div className="gf-about">
                  <div className="gf-cap2" style={{ marginBottom: 7 }}>About this goal</div>
                  <p className="gf-about-d">{goal.smart_description}</p>
                  <p className="gf-about-q">"{goal.raw_input}"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
