import { useState } from 'react'
import { useUser } from '@clerk/react'
import { todayStr } from '../lib/gamification'
import type { Goal } from '../lib/types'

function greetingFor(h: number) {
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function GreetingStrip({ goals }: { goals: Goal[] }) {
  const { user } = useUser()
  const name = user?.firstName ?? 'there'
  // Greeting computed once on mount (ESLint bans new Date() in render body).
  const [greeting] = useState(() => greetingFor(new Date().getHours()))

  const today = todayStr()
  const todayTasks = goals
    .filter(g => g.status === 'active')
    .flatMap(g => g.daily_tasks.filter(t => t.assigned_date === today))
  const done = todayTasks.filter(t => t.is_completed).length
  const total = todayTasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="gf-greet">
      <div className="gf-greet-l">
        <img src="/solly/waving-hand.svg" alt="" className="gf-greet-wave" width={34} height={34} />
        <div>
          <div className="gf-greet-hi">{greeting}, {name}</div>
          <div className="gf-greet-sub">{done} of {total} tasks done today</div>
        </div>
      </div>
      <div className="gf-greet-prog">
        <div className="gf-greet-prog-head">
          <span className="gf-greet-prog-pct">{pct}<span>%</span></span>
          <span className="gf-greet-prog-lbl">today</span>
        </div>
        <div className="gf-greet-prog-track">
          <div className="gf-greet-prog-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
