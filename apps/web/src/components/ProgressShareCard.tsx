import { useMemo } from 'react'
import { Creature } from './GamificationSvgs'
import { getStage, streak } from '../lib/gamification'
import type { Goal } from '../lib/types'

// ── Motivational quotes (cycled by total completed tasks mod 6) ───────────────
const QUOTES = [
  "Small steps every day build empires.",
  "Consistency is the magic ingredient.",
  "Every task completed is a vote for who you're becoming.",
  "The stars don't shine without darkness — keep going.",
  "Progress is progress, no matter how small.",
  "You are further along than yesterday. That's everything.",
]

interface ProgressShareCardProps {
  goal: Goal
  pts: number
}

export default function ProgressShareCard({ goal, pts }: ProgressShareCardProps) {
  const stage = getStage(pts)

  const totalCompleted = goal.completed_days.length
  const currentStreak  = streak(goal.completed_days)
  const activeMilestone = goal.milestones.find(m => m.sprint_status === 'active')
    ?? goal.milestones.find(m => m.is_completed) // fall back to last completed if all done

  const quote = useMemo(() => {
    const allCompletedTasks = goal.daily_tasks.filter(t => t.is_completed).length
    return QUOTES[allCompletedTasks % QUOTES.length]
  }, [goal.daily_tasks])

  const stageColor = stage.color

  return (
    <div
      style={{
        width: 540,
        minHeight: 320,
        background: 'linear-gradient(135deg, #0f0a2e 0%, #0e0e1a 45%, #07070f 100%)',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'JetBrains Mono', monospace",
        border: `1px solid ${stageColor}30`,
        boxShadow: `0 0 60px ${stageColor}18, 0 0 120px #3730a318`,
      }}
    >
      {/* Background glow orb */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${stageColor}20 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, #4338ca18 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Top bar — logo + stage badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 22px 0',
      }}>
        {/* GoalForge wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#07070f',
          }}>✦</div>
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
            color: '#e8e8f0', fontFamily: "'JetBrains Mono', monospace",
          }}>GoalForge</span>
        </div>

        {/* Stage badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: `${stageColor}18`,
          border: `1px solid ${stageColor}50`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: stageColor }}>
            {stage.name.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: 0, padding: '14px 22px 20px', alignItems: 'flex-start' }}>

        {/* Left — creature + pts */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginRight: 18 }}>
          <Creature pts={pts} size={110} />
          <div style={{
            textAlign: 'center',
            fontSize: 11, color: '#f97316', fontWeight: 600, letterSpacing: '0.06em',
          }}>
            ✦ {pts} stars
          </div>
        </div>

        {/* Right — text content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Headline */}
          <div style={{
            fontSize: 18, fontWeight: 700, lineHeight: 1.3,
            color: '#e8e8f0',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            marginBottom: 4,
          }}>
            I just hit <span style={{ color: stageColor }}>{stage.name}</span> on GoalForge! 🔥
          </div>

          {/* Goal title */}
          <div style={{
            fontSize: 13, color: '#a0a0b8',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            lineHeight: 1.5, marginBottom: 14,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {goal.smart_title}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <StatChip label="TASKS DONE" value={String(goal.daily_tasks.filter(t => t.is_completed).length)} color="#34d399" />
            <StatChip label="STARS" value={String(pts)} color="#f97316" />
            <StatChip label="DAY STREAK" value={`${currentStreak}d`} color="#818cf8" />
          </div>

          {/* Current milestone */}
          {activeMilestone && (
            <div style={{
              padding: '7px 11px', borderRadius: 8, marginBottom: 12,
              background: '#818cf810',
              border: '1px solid #818cf830',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ fontSize: 9, color: '#818cf8', letterSpacing: '0.1em', fontWeight: 600 }}>MILESTONE</span>
              <span style={{ fontSize: 11, color: '#e8e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeMilestone.title}
              </span>
            </div>
          )}

          {/* Quote */}
          <div style={{
            fontSize: 10, color: '#71717a',
            fontStyle: 'italic', lineHeight: 1.6,
            borderLeft: '2px solid #f9731640',
            paddingLeft: 9,
          }}>
            "{quote}"
          </div>
        </div>
      </div>

      {/* Bottom watermark */}
      <div style={{
        padding: '10px 22px 14px',
        borderTop: '1px solid #1c1c30',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#3f3f5c', letterSpacing: '0.08em' }}>
          {totalCompleted} active days total
        </span>
        <span style={{ fontSize: 9, color: '#3f3f5c', letterSpacing: '0.08em' }}>
          goalforge.app
        </span>
      </div>
    </div>
  )
}

// ── Inline stat chip ──────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '5px 10px', borderRadius: 8,
      background: `${color}10`, border: `1px solid ${color}30`,
      minWidth: 64,
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.01em' }}>{value}</span>
      <span style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.08em', marginTop: 1 }}>{label}</span>
    </div>
  )
}
