import { useState, useEffect } from 'react'
import { UserButton, useUser, useAuth } from '@clerk/react'
import { Target, Sparkles, Star, Circle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import api, { setAuthToken } from '../lib/api'
import CreateGoalModal from '../components/CreateGoalModal'

// ---------------------------------------------------------------------------
// Types (mirror schemas.py)
// ---------------------------------------------------------------------------

interface Task {
  id: string
  goal_id: string
  description: string
  tip: string
  assigned_date: string
  is_completed: boolean
  completed_at: string | null
}

interface Goal {
  id: string
  smart_title: string
  smart_description: string
  goal_type: string
  target_date: string
  milestones: string[]
  status: 'active' | 'completed' | 'abandoned'
  current_streak: number
  best_streak: number
  vitality: number
  daily_tasks: Task[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user } = useUser()
  const { getToken } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let ignore = false

    async function fetchGoals() {
      try {
        const token = await getToken()
        setAuthToken(token)
        const { data } = await api.get<Goal[]>(`/users/${user!.id}/goals`)
        if (!ignore) setGoals(data)
      } catch {
        if (!ignore) setError('Failed to load goals. Please refresh.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchGoals()
    return () => { ignore = true }
  }, [user?.id, getToken, refreshKey])

  const VITALITY_PER_TASK = 10

  async function completeTask(taskId: string) {
    // Optimistic update: mark task done + bump vitality
    setGoals(prev =>
      prev.map(goal => ({
        ...goal,
        vitality: goal.daily_tasks.some(t => t.id === taskId)
          ? Math.min(100, goal.vitality + VITALITY_PER_TASK)
          : goal.vitality,
        daily_tasks: goal.daily_tasks.map(task =>
          task.id === taskId ? { ...task, is_completed: true } : task
        ),
      }))
    )
    toast.success('Task completed! +10 Vitality', {
      icon: '⚡',
    })
    try {
      await api.patch(`/tasks/${taskId}/complete`)
    } catch {
      // Roll back on failure
      setGoals(prev =>
        prev.map(goal => ({
          ...goal,
          vitality: goal.daily_tasks.some(t => t.id === taskId)
            ? Math.max(0, goal.vitality - VITALITY_PER_TASK)
            : goal.vitality,
          daily_tasks: goal.daily_tasks.map(task =>
            task.id === taskId ? { ...task, is_completed: false } : task
          ),
        }))
      )
      toast.error('Could not save task. Please try again.')
    }
  }

  function startEdit(task: Task) {
    setDeletingTaskId(null)
    setEditingTaskId(task.id)
    setEditingText(task.description)
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditingText('')
  }

  async function saveEdit(taskId: string, originalDescription: string) {
    const trimmed = editingText.trim()
    if (!trimmed || trimmed === originalDescription) {
      cancelEdit()
      return
    }
    setGoals(prev =>
      prev.map(goal => ({
        ...goal,
        daily_tasks: goal.daily_tasks.map(t =>
          t.id === taskId ? { ...t, description: trimmed } : t
        ),
      }))
    )
    cancelEdit()
    try {
      await api.patch(`/tasks/${taskId}`, { description: trimmed })
      toast.success('Task updated')
    } catch {
      setGoals(prev =>
        prev.map(goal => ({
          ...goal,
          daily_tasks: goal.daily_tasks.map(t =>
            t.id === taskId ? { ...t, description: originalDescription } : t
          ),
        }))
      )
      toast.error('Could not update task. Please try again.')
    }
  }

  function startDelete(taskId: string) {
    setEditingTaskId(null)
    setEditingText('')
    setDeletingTaskId(taskId)
  }

  async function confirmDelete(taskId: string) {
    const deletedTask = goals.flatMap(g => g.daily_tasks).find(t => t.id === taskId)
    setGoals(prev =>
      prev.map(goal => ({
        ...goal,
        daily_tasks: goal.daily_tasks.filter(t => t.id !== taskId),
      }))
    )
    setDeletingTaskId(null)
    try {
      await api.delete(`/tasks/${taskId}`)
      toast.success('Task deleted')
    } catch {
      if (deletedTask) {
        setGoals(prev =>
          prev.map(goal =>
            goal.id === deletedTask.goal_id
              ? { ...goal, daily_tasks: [...goal.daily_tasks, deletedTask] }
              : goal
          )
        )
      }
      toast.error('Could not delete task. Please try again.')
    }
  }

  const activeGoal = goals.find(g => g.status === 'active')

  // ---------------------------------------------------------------------------
  // Vitality bar colour
  // ---------------------------------------------------------------------------

  function vitalityColour(v: number) {
    if (v > 60) return 'from-green-500 to-emerald-400'
    if (v > 30) return 'from-yellow-500 to-amber-400'
    return 'from-red-600 to-rose-400'
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white flex flex-col">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Target className="text-violet-400" size={22} />
          GoalForge
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {user?.firstName ? `Hey, ${user.firstName}!` : 'Dashboard'}
          </span>
          <UserButton />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full flex flex-col gap-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-6 py-4 text-sm">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && goals.length === 0 && (
          <>
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                <Star size={30} className="text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles size={16} className="text-violet-400" />
                  Your Star Companion
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Your companion is waiting. Forge your first goal to bring them to life!
                </p>
              </div>
            </section>

            <section className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-4">
              <Target size={48} className="text-slate-600" />
              <p className="font-semibold text-xl text-slate-300">No goals yet</p>
              <p className="text-sm text-slate-500">
                Let the AI forge your first structured goal from a simple description.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold transition-colors"
              >
                Create Your First Goal
              </button>
            </section>
          </>
        )}

        {/* Goals view */}
        {!loading && !error && goals.length > 0 && (
          <>
            {/* ── Star Companion + Vitality bar ── */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                  <Star size={30} className="text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles size={16} className="text-violet-400" />
                    Your Star Companion
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {activeGoal
                      ? `Focused on: ${activeGoal.smart_title}`
                      : 'No active goal — start a new one!'}
                  </p>
                </div>
              </div>

              {/* Vitality bar — only when there's an active goal */}
              {activeGoal && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-medium">Vitality</span>
                    <span className="font-bold tabular-nums">
                      {activeGoal.vitality}
                      <span className="text-slate-500 font-normal"> / 100</span>
                    </span>
                  </div>

                  {/* RPG health bar */}
                  <div className="relative h-5 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${vitalityColour(activeGoal.vitality)}`}
                      style={{ width: `${activeGoal.vitality}%` }}
                    />
                    {/* Tick marks */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="flex-1 border-r border-black/25 last:border-0" />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-5 text-xs text-slate-400 pt-0.5">
                    <span>🔥 Streak <span className="text-white font-semibold">{activeGoal.current_streak}d</span></span>
                    <span>🏆 Best <span className="text-white font-semibold">{activeGoal.best_streak}d</span></span>
                    <span className="capitalize">📌 {activeGoal.goal_type}</span>
                    <span>🗓 Due {activeGoal.target_date}</span>
                  </div>
                </div>
              )}
            </section>

            {/* ── Goals list ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-xl">Your Goals</h2>
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
                >
                  + New Goal
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {goals.map(goal => (
                  <div
                    key={goal.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4"
                  >
                    {/* Goal header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg leading-snug">{goal.smart_title}</h3>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{goal.smart_description}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border shrink-0 ${
                        goal.status === 'active'
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                          : goal.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}>
                        {goal.status}
                      </span>
                    </div>

                    {/* Daily tasks */}
                    {goal.daily_tasks.length > 0 && (
                      <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                          Today's Tasks
                        </p>
                        {goal.daily_tasks.map(task => {
                          const isEditing = editingTaskId === task.id
                          const isDeleting = deletingTaskId === task.id
                          return (
                            <div
                              key={task.id}
                              className="flex items-start gap-3 group"
                            >
                              {/* Complete toggle — only when not editing */}
                              <span
                                className={`mt-0.5 shrink-0 transition-colors ${!task.is_completed && !isEditing ? 'cursor-pointer' : ''}`}
                                onClick={() => !task.is_completed && !isEditing && completeTask(task.id)}
                              >
                                {task.is_completed
                                  ? <CheckCircle2 size={18} className="text-emerald-400" />
                                  : <Circle size={18} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                                }
                              </span>

                              {/* Description area */}
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    value={editingText}
                                    onChange={e => setEditingText(e.target.value)}
                                    onBlur={() => saveEdit(task.id, task.description)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveEdit(task.id, task.description)
                                      if (e.key === 'Escape') cancelEdit()
                                    }}
                                    className="w-full text-sm bg-white/10 border border-violet-500/50 rounded-md px-2 py-0.5 text-white focus:outline-none focus:border-violet-400"
                                  />
                                ) : (
                                  <>
                                    <p className={`text-sm transition-colors ${
                                      task.is_completed
                                        ? 'line-through text-slate-500'
                                        : 'text-slate-200'
                                    }`}>
                                      {task.description}
                                    </p>
                                    {!task.is_completed && (
                                      <p className="text-xs text-slate-500 mt-0.5">{task.tip}</p>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Action icons — pending tasks only */}
                              {!task.is_completed && !isEditing && (
                                <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  {isDeleting ? (
                                    <>
                                      <button
                                        onClick={() => confirmDelete(task.id)}
                                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors px-1.5 py-0.5 rounded border border-red-500/30 hover:border-red-400/50"
                                      >
                                        <Trash2 size={12} />
                                        Delete
                                      </button>
                                      <button
                                        onClick={() => setDeletingTaskId(null)}
                                        className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => startEdit(task)}
                                        className="text-slate-500 hover:text-violet-400 transition-colors p-0.5"
                                        title="Edit task"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => startDelete(task.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                                        title="Delete task"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

      </main>

      <CreateGoalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          setLoading(true)
          setRefreshKey(k => k + 1)
        }}
      />
    </div>
  )
}
