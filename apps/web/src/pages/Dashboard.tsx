import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/react'
import { toast } from 'sonner'
import api, { setAuthToken } from '../lib/api'
import { T } from '../lib/theme'
import { todayStr } from '../lib/gamification'
import type { Goal, Task } from '../lib/types'
import AppHeader from '../components/AppHeader'
import { Creature } from '../components/GamificationSvgs'
import TodayBar from '../components/TodayBar'
import AddGoal from '../components/AddGoal'
import GoalCard from '../components/GoalCard'

// ── EmptyState (onboarding for new users) ─────────────────────────────────────
const EXAMPLE_GOALS = [
  'I want to learn Spanish basics in 3 months',
  'Get in shape — lose 10 lbs by summer',
  'Read 12 books this year',
]

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: '40px 16px 32px',
      animation: 'fadeUp 0.5s ease both',
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 480 }}>
        {EXAMPLE_GOALS.map(text => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            style={{
              minHeight: 44, padding: '10px 16px', borderRadius: 22,
              fontFamily: T.mono, fontSize: 12, cursor: 'pointer',
              background: `${T.indigo}12`, color: T.indigo,
              border: `1px solid ${T.indigo}35`,
              transition: 'background 0.15s, border-color 0.15s',
              lineHeight: 1.4, textAlign: 'left',
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
  const [filter,  setFilter]  = useState<string>('all')
  const [addGoalText, setAddGoalText] = useState('')

  // Task edit state
  const [editingTaskId,  setEditingTaskId]  = useState<string | null>(null)
  const [editingText,    setEditingText]    = useState('')

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
        if (!ignore) setError('Failed to load goals. Please refresh.')
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
      toast.error('Could not create goal. Please try again.')
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
    toast.success('Task completed! +10 pts', { icon: '⚡' })

    api.patch(`/tasks/${taskId}/complete`).catch(() => {
      setGoals(prev => prev.map(goal => {
        if (!goal.daily_tasks.some(t => t.id === taskId)) return goal
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
      toast.error('Could not save task. Please try again.')
    })
  }

  // ── Task edit ──
  function startEdit(task: Task) {
    setEditingTaskId(task.id)
    setEditingText(task.description)
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditingText('')
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
      toast.success('Task updated')
    } catch {
      setGoals(prev => prev.map(g => ({
        ...g,
        daily_tasks: g.daily_tasks.map(t => t.id === taskId ? { ...t, description: original } : t),
      })))
      toast.error('Could not update task.')
    }
  }

  // ── Delete goal ──
  async function deleteGoal(goalId: string) {
    const deleted = goals.find(g => g.id === goalId)
    setGoals(prev => prev.filter(g => g.id !== goalId))
    try {
      await api.delete(`/goals/${goalId}`)
      toast.success('Goal deleted')
    } catch {
      if (deleted) setGoals(prev => [...prev, deleted])
      toast.error('Could not delete goal.')
    }
  }

  // ── Complete sprint milestone ──
  async function completeMilestone(goalId: string, milestoneId: string) {
    try {
      const { data } = await api.post<Goal>(`/goals/${goalId}/milestones/${milestoneId}/complete`)
      setGoals(prev => prev.map(g => g.id === goalId ? data : g))
      toast.success('Sprint complete! Next sprint unlocked. ✦')
    } catch {
      toast.error('Could not complete sprint. Please try again.')
    }
  }

  // ── Status change ──
  async function changeStatus(goalId: string, newStatus: 'active' | 'achieved' | 'abandoned') {
    const prev_status = goals.find(g => g.id === goalId)?.status
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: newStatus } : g))
    if (newStatus === 'achieved' && prev_status !== 'achieved') {
      setPts(p => p + 100)
      toast.success('Goal achieved! +100 pts 🏆')
    }
    try {
      await api.patch(`/goals/${goalId}`, { status: newStatus })
    } catch {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: prev_status ?? 'active' } : g))
      if (newStatus === 'achieved' && prev_status !== 'achieved') setPts(p => p - 100)
      toast.error('Could not update goal status.')
    }
  }

  const filtered = filter === 'all' ? goals : goals.filter(g => g.status === filter)

  // ── Render ──
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.mono }}>
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

      <div style={{ maxWidth: 1100, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Your Goals
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>
            {goals.filter(g => g.status === 'active').length} active · {goals.length} total
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: 'spin 0.75s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: '14px 18px', background: `${T.rose}10`, border: `1px solid ${T.rose}30`, borderRadius: 10, color: T.rose, fontSize: 13 }}>
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
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 18, overflowX: 'auto', scrollbarWidth: 'none' }} className="filter-tabs">
                  {(['all', 'active', 'achieved', 'abandoned'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '7px 14px', fontFamily: T.mono, fontSize: 11,
                        letterSpacing: '0.06em', flexShrink: 0,
                        color: filter === f ? T.text : T.muted,
                        borderBottom: filter === f ? `2px solid ${T.orange}` : '2px solid transparent',
                      }}
                    >
                      {f} ({goals.filter(g => f === 'all' ? true : g.status === f).length})
                    </button>
                  ))}
                </div>

                {/* Goal list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '44px 0', color: T.muted, fontSize: 13 }}>
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
