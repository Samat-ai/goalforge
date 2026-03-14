import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/react'
import api, { setAuthToken } from '../lib/api'
import AppHeader from '../components/AppHeader'
import { Creature } from '../components/GamificationSvgs'
import { STAGES, getStage, getNext, stagePct, streak } from '../lib/gamification'
import { T } from '../lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string
  assigned_date: string
  is_completed: boolean
}

interface Goal {
  id: string
  raw_input: string
  smart_title: string
  smart_description: string
  goal_type: string
  target_date: string
  milestones: string[]
  status: 'active' | 'achieved' | 'abandoned'
  current_streak: number
  best_streak: number
  progress: number
  created_at: string
  daily_tasks: Task[]
  completed_days: string[]
}

// ── Analytics page ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user }     = useUser()
  const { getToken } = useAuth()

  const [goals,   setGoals]   = useState<Goal[]>([])
  const [pts,     setPts]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    let ignore = false

    async function load() {
      try {
        const token = await getToken()
        setAuthToken(token)
        const [goalsRes, profileRes] = await Promise.all([
          api.get<{ items: Goal[]; total: number; limit: number; offset: number }>(`/users/${userId}/goals?limit=100&offset=0`),
          api.get<{ star_points: number }>(`/users/${userId}/profile`).catch(() => ({ data: { star_points: 0 } })),
        ])
        if (!ignore) {
          setGoals(goalsRes.data.items)
          setPts(profileRes.data.star_points)
        }
      } catch {
        if (!ignore) setError("Failed to load data. Please refresh.")
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [user?.id, getToken])

  const stage   = getStage(pts)
  const next    = getNext(pts)
  const pct     = stagePct(pts)
  const achieved = goals.filter(g => g.status === 'achieved')

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        button:focus-visible, a:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <AppHeader pts={pts} />

      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Your Companion
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>Complete tasks to evolve your star creature</p>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: `${T.rose}10`, border: `1px solid ${T.rose}30`, borderRadius: 10, color: T.rose, fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: "spin 0.75s linear infinite",
            }} />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Creature hero ── */}
            <div style={{
              background: T.card, border: `1px solid ${stage.color}45`, borderRadius: 15,
              padding: "28px 22px", marginBottom: 26,
              display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Creature pts={pts} size={180} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: T.serif, fontSize: 24, color: stage.color }}>{stage.name}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>
                    stage {stage.id + 1} of {STAGES.length}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 4 }}>
                  YOUR COMPANION
                </div>
                <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.7, marginBottom: 18, fontStyle: "italic" }}>
                  "{stage.desc}"
                </div>

                {/* Points bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>STAR POINTS</span>
                    <span style={{ fontSize: 13, color: stage.color, fontFamily: T.mono }}>{pts} pts</span>
                  </div>
                  <div style={{ height: 7, background: T.dim, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: stage.color,
                      width: `${pct * 100}%`, transition: "width 0.8s",
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 4 }}>
                    {next ? `${next.pts - pts} pts to evolve into ${next.name}` : "✦ Maximum evolution reached"}
                  </div>
                </div>

                {/* Evolution path */}
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                  {STAGES.map((s, i) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div
                        title={`${s.name} — ${s.pts} pts`}
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: pts >= s.pts ? `${s.color}30` : T.surface,
                          border: `2px solid ${pts >= s.pts ? s.color : T.dim}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: pts >= s.pts ? s.color : T.dim, fontFamily: T.mono,
                        }}
                      >
                        {pts >= s.pts ? "✦" : "·"}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{ width: 10, height: 2, background: pts > s.pts ? s.color : T.dim, borderRadius: 1 }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, marginTop: 5, overflowWrap: "break-word" }}>
                  {STAGES.map(s => s.name).join(" → ")}
                </div>
              </div>
            </div>

            {/* ── How to earn ── */}
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11,
              padding: "15px 18px", marginBottom: 24,
            }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 11 }}>
                HOW TO EARN STAR POINTS
              </div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                {[
                  { icon: "✦",  label: "Complete any task",     pts: "+10 pts" },
                  { icon: "🏆", label: "Achieve a goal",        pts: "+100 pts" },
                  { icon: "🔥", label: "Consistency is key",    pts: "keeps your star bright" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, color: T.text, fontFamily: T.mono }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: T.amber, fontFamily: T.mono }}>{item.pts}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Completion rate by goal ── */}
            {goals.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 14 }}>
                  COMPLETION RATE BY GOAL
                </div>
                {goals.filter(g => g.status !== 'abandoned').map(g => {
                  const daysElapsed = Math.max(1, Math.floor((Date.now() - new Date(g.created_at).getTime()) / 864e5))
                  const rate = g.completed_days.length / daysElapsed
                  const s    = streak(g.completed_days)
                  const col  = g.status === 'achieved' ? T.amber : T.orange
                  const lbl  = g.raw_input.length > 26 ? g.raw_input.slice(0, 26) + "…" : g.raw_input
                  return (
                    <div key={g.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, flexWrap: "wrap", gap: "2px 8px" }}>
                        <span style={{ fontSize: 12, color: T.textDim, flexShrink: 0 }}>{lbl}</span>
                        <span style={{ fontSize: 11, color: col, fontFamily: T.mono, flexShrink: 0 }}>
                          {Math.round(rate * 100)}% · {g.completed_days.length}d · {s}d streak
                        </span>
                      </div>
                      <div style={{ height: 7, background: T.dim, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3, background: col,
                          width: `${Math.min(rate * 100, 100)}%`, transition: "width 0.7s",
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Stats grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 11, marginBottom: 28 }}>
              {[
                { label: "Active Goals",   value: goals.filter(g => g.status === "active").length,                                      color: T.orange },
                { label: "Total Days",     value: goals.reduce((a, g) => a + g.completed_days.length, 0),                               color: T.emerald },
                { label: "Best Streak",    value: Math.max(0, ...goals.map(g => streak(g.completed_days))) + "d",                       color: T.amber },
                { label: "Star Points",    value: pts,                                                                                  color: stage.color },
              ].map(s => (
                <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "13px 15px" }}>
                  <div style={{ fontFamily: T.mono, fontSize: 26, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Hall of Fame ── */}
            <div>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", fontFamily: T.mono, marginBottom: 14 }}>
                HALL OF FAME — {achieved.length} {achieved.length === 1 ? "GOAL" : "GOALS"} ACHIEVED
              </div>

              {achieved.length === 0 && (
                <div style={{
                  background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
                  padding: "36px 22px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🏆</div>
                  <div style={{ fontSize: 13, color: T.muted, fontFamily: T.mono }}>
                    No goals achieved yet. Complete your first goal to unlock the Hall of Fame.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {achieved.map(g => {
                  const s = streak(g.completed_days)
                  return (
                    <div key={g.id} style={{
                      background: T.card, border: `1px solid ${T.amber}40`,
                      borderLeft: `3px solid ${T.amber}`,
                      borderRadius: "0 12px 12px 0", padding: "18px",
                      position: "relative", overflow: "hidden",
                    }}>
                      {/* Gold shimmer */}
                      <div style={{
                        position: "absolute", top: -30, right: -30,
                        width: 100, height: 100, borderRadius: "50%",
                        background: `radial-gradient(circle, ${T.amber}12, transparent)`,
                        pointerEvents: "none",
                      }} />

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>🏆</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 20,
                              fontFamily: T.mono, textTransform: "uppercase", letterSpacing: "0.07em",
                              border: `1px solid ${T.amber}50`, background: `${T.amber}15`, color: T.amber,
                            }}>
                              {g.goal_type}
                            </span>
                            {s > 0 && (
                              <span style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 20,
                                fontFamily: T.mono, textTransform: "uppercase", letterSpacing: "0.07em",
                                border: `1px solid ${T.orange}50`, background: `${T.orange}15`, color: T.orange,
                              }}>
                                {s}d streak
                              </span>
                            )}
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 20,
                              fontFamily: T.mono, textTransform: "uppercase", letterSpacing: "0.07em",
                              border: `1px solid ${T.emerald}50`, background: `${T.emerald}15`, color: T.emerald,
                            }}>
                              {g.completed_days.length} days completed
                            </span>
                          </div>

                          <div style={{ fontFamily: T.serif, fontSize: 16, color: T.amber, marginBottom: 4, lineHeight: 1.4 }}>
                            {g.smart_title}
                          </div>
                          <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 4 }}>
                            {g.smart_description}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>"{g.raw_input}"</div>

                          {/* Progress bar (should be 100% for achieved) */}
                          {g.progress > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ height: 4, background: T.dim, borderRadius: 2, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", borderRadius: 2, background: T.amber,
                                  width: `${g.progress}%`, transition: "width 0.7s",
                                }} />
                              </div>
                              <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, marginTop: 3 }}>
                                {g.progress}% progress tracked
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
