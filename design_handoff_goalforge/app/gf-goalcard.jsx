// gf-goalcard.jsx — collapsible goal card with today / sprints / history tabs.
const { useState: useGS, useMemo: useGM, useRef: useGR } = React;

// ── PuffyStar (brightness-driven signature glyph) ───────────────────────────────
function PuffyStar({ brightness = 0.8, size = 46 }) {
  const uid = useGM(() => 'ps' + Math.random().toString(36).slice(2, 7), []);
  const n = brightness;
  return (
    <div className="gf-puffy" style={{ width: size, height: size }}>
      <div className="gf-puffy-glow" style={{ background: `radial-gradient(circle, rgba(251,191,36,${0.12 + n * 0.3}) 30%, transparent 72%)` }} />
      <svg viewBox="0 0 100 100" width={size * 0.86} height={size * 0.86} style={{ position: 'relative', zIndex: 1, overflow: 'visible' }}>
        <defs>
          <radialGradient id={uid} cx="40%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0.25 + n * 0.7} />
          </radialGradient>
        </defs>
        <polygon points="50,12 59.9,36.2 86.1,38.3 66.2,55.3 72.4,80.7 50,67 27.6,80.7 33.8,55.3 13.9,38.3 40.1,36.2"
          fill={`url(#${uid})`} stroke="rgba(251,191,36,0.35)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Completion calendar (8 weeks) ───────────────────────────────────────────────
const GC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GC_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function gcPretty(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${GC_DOW[dt.getDay()]}, ${GC_MON[m - 1]} ${d}`;
}
function MiniCalendar({ days }) {
  const D = window.GF_DATA;
  const set = useGM(() => new Set(days), [days]);
  const weeks = useGM(() => {
    const total = 56; const today = new Date(); today.setHours(12, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (total - 1));
    const dow = (start.getDay() + 6) % 7;            // 0 = Monday
    start.setDate(start.getDate() - dow);            // align back to Monday
    const cells = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const iso = D.fmt(d);
      cells.push({ iso, state: d > today ? 'future' : set.has(iso) ? 'done' : 'miss' });
    }
    const w = []; for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [set]);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="gf-cal">
      <div className="gf-cal-labels">
        {labels.map((l, i) => <span key={i} className="gf-cal-lbl">{l}</span>)}
      </div>
      <div className="gf-cal-weeks">
        {weeks.map((wk, wi) => (
          <div key={wi} className="gf-cal-col">
            {wk.map((c, di) => <span key={di} className={cx('gf-cal-cell', c.state === 'done' && 'is-done', c.state === 'future' && 'is-future')}
              onMouseMove={c.state === 'future' ? undefined : (e) => gfTip(e, `<b>${c.state === 'done' ? 'Completed' : 'No activity'}</b><span>${gcPretty(c.iso)}</span>`)}
              onMouseLeave={c.state === 'future' ? undefined : gfHideTip} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Streak bars ─────────────────────────────────────────────────────────────────
function StreakBars({ days }) {
  const D = window.GF_DATA;
  const { streaks, longest, current, total } = useGM(() => {
    const set = new Set(days); const today = new Date(); today.setHours(12, 0, 0, 0);
    const arr = []; for (let i = 55; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); arr.push(set.has(D.fmt(d))); }
    const sk = []; let i = 0; while (i < arr.length) { if (arr[i]) { const s = i; while (i < arr.length && arr[i]) i++; sk.push({ start: s, len: i - s }); } else i++; }
    const longest = Math.max(...sk.map(s => s.len), 1);
    let current = 0; if (arr[arr.length - 1]) { let j = arr.length - 1; while (j >= 0 && arr[j]) { current++; j--; } }
    return { streaks: sk, longest, current, total: arr.filter(Boolean).length };
  }, [days]);
  return (
    <div>
      <div className="gf-sb-stats">
        {[['Current', current], ['Longest', longest], ['Total', total]].map(([l, v]) => (
          <div key={l}><div className="gf-sb-lbl">{l}</div><div className="gf-sb-val">{v}<span>days</span></div></div>
        ))}
      </div>
      <div className="gf-sb-track">
        <div className="gf-sb-baseline" />
        {streaks.map((s, idx) => {
          const left = (s.start / 56) * 100, width = Math.max((s.len / 56) * 100, 0.6);
          const isCur = idx === streaks.length - 1 && current > 0;
          const h = 4 + Math.round((s.len / longest) * 18);
          return <div key={idx} className={cx('gf-sb-bar', isCur && 'is-cur', s.len === longest && 'is-long')}
            onMouseMove={(e) => gfTip(e, `<b>${s.len}</b>-day streak${isCur ? '<span>current \u00b7 ongoing</span>' : s.len === longest ? '<span>longest streak</span>' : ''}`)}
            onMouseLeave={gfHideTip}
            style={{ left: `${left}%`, width: `${width}%`, height: h, top: `${20 - h / 2}px` }} />;
        })}
      </div>
    </div>
  );
}

// ── Tab content ─────────────────────────────────────────────────────────────────
function TaskRowG({ task, overdue, onToggle }) {
  return (
    <button className={cx('gf-task', task.done && 'is-done', overdue && 'is-overdue')} onClick={onToggle}>
      <span className="gf-check"><Icon name="check" size={13} stroke={3} /></span>
      <span className="gf-task-label">{task.title}</span>
      {overdue && !task.done && <span className="gf-task-tag">overdue</span>}
    </button>
  );
}

function TodayTab({ goal, onToggle, onCelebrate }) {
  const done = goal.tasks.filter(t => t.done).length;
  const total = goal.tasks.length;
  const allDone = total > 0 && done === total;
  const [confirm, setConfirm] = useGS(null);
  return (
    <div className="gf-tabpane">
      {total > 0 && (
        <div className="gf-mini">
          <div className="gf-mini-track"><div className="gf-mini-fill" style={{ width: `${(done / total) * 100}%` }} /></div>
          <span className="gf-mini-c">{done}/{total} tasks</span>
        </div>
      )}
      <div className="gf-tasks">
        {goal.overdue && goal.overdue.length > 0 && goal.overdue.map(t => (
          <TaskRowG key={t.id} task={t} overdue onToggle={() => { if (!t.done) onCelebrate(); onToggle(goal.id, t.id, 'overdue'); }} />
        ))}
        {goal.tasks.map(t => (
          <TaskRowG key={t.id} task={t} onToggle={() => { if (!t.done) onCelebrate(); onToggle(goal.id, t.id, 'tasks'); }} />
        ))}
      </div>
      <div className="gf-gc-actions">
        {allDone
          ? <button className="gf-btn-pill is-sprint"><Icon name="spark" size={12} /> Complete Sprint → next</button>
          : <span className="gf-gc-hint">{total - done} task{total - done === 1 ? '' : 's'} left today</span>}
        <button className={cx('gf-btn-pill is-warn', confirm === 'abandon' && 'is-armed')} onClick={() => setConfirm(confirm === 'abandon' ? null : 'abandon')}>{confirm === 'abandon' ? 'Sure? Abandon' : 'Abandon'}</button>
        <button className={cx('gf-btn-pill is-danger', confirm === 'delete' && 'is-armed')} onClick={() => setConfirm(confirm === 'delete' ? null : 'delete')}>{confirm === 'delete' ? 'Sure? Delete' : 'Delete'}</button>
      </div>
    </div>
  );
}

const MS_STATUS = {
  completed: { ic: 'check', cls: 'is-done', label: 'done' },
  active: { ic: null, cls: 'is-active', label: 'active' },
  upcoming: { ic: null, cls: 'is-up', label: '' },
  failed: { ic: 'plus', cls: 'is-fail', label: 'failed' },
};

function SprintsTab({ goal }) {
  const totalM = goal.milestones.length;
  const doneM = goal.milestones.filter(m => m.status === 'completed').length;
  const pct = totalM ? Math.round((doneM / totalM) * 100) : 0;
  return (
    <div className="gf-tabpane">
      <div className="gf-ov">
        <div className="gf-ov-top"><span className="gf-cap2">Overall progress</span><span className="gf-ov-pct">{pct}%</span></div>
        <div className="gf-bar"><div className="gf-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="gf-ov-sub">{doneM} of {totalM} sprints completed</div>
      </div>
      <div className="gf-cap2" style={{ marginBottom: 10 }}>Milestones</div>
      <div className="gf-ms-list">
        {goal.milestones.map(m => {
          const s = MS_STATUS[m.status];
          return (
            <div key={m.pos} className="gf-ms">
              <span className={cx('gf-ms-dot', s.cls)}>{m.status === 'completed' ? <Icon name="check" size={11} stroke={3} /> : m.status === 'failed' ? '×' : m.pos}</span>
              <span className={cx('gf-ms-title', s.cls)}>{m.title}</span>
              {s.label && <span className={cx('gf-ms-tag', s.cls)}>{s.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab({ goal }) {
  const [view, setView] = useGS('streaks');
  const b = goal.brightness ?? 0.6;
  const bMsg = b < 0.3 ? 'Almost out — complete tasks to recharge' : b < 0.6 ? 'Fading — keep going' : 'Burning bright';
  return (
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
            {['calendar', 'streaks'].map(v => (
              <button key={v} className={cx('gf-toggle-b', view === v && 'is-on')} onClick={() => setView(v)}>{v === 'calendar' ? 'weeks' : 'streaks'}</button>
            ))}
          </div>
        </div>
        {view === 'calendar' ? <MiniCalendar days={goal.completed_days} /> : <StreakBars days={goal.completed_days} />}
      </div>
      <div className="gf-about">
        <div className="gf-cap2" style={{ marginBottom: 7 }}>About this goal</div>
        <p className="gf-about-d">{goal.smart_description}</p>
        <p className="gf-about-q">“{goal.raw_input}”</p>
      </div>
    </div>
  );
}

// ── GoalCard ────────────────────────────────────────────────────────────────────
function GoalCard({ goal, index = 0, onToggle, onCelebrate, defaultOpen = false }) {
  const [open, setOpen] = useGS(defaultOpen);
  const [tab, setTab] = useGS('today');
  const ic = GOAL_ICON[goal.goal_type] || 'target';
  const doneToday = goal.tasks.length > 0 && goal.tasks.every(t => t.done);
  const tabIndex = { today: 0, sprints: 1, history: 2 }[tab];
  const ratio = goal.tasks.length ? goal.tasks.filter(t => t.done).length / goal.tasks.length : 0;

  return (
    <Reveal className="gf-card gf-gc" delay={index * 70} style={{ boxShadow: ratio > 0 ? `0 0 ${14 + ratio * 16}px rgba(52,211,153,${(0.07 + ratio * 0.1).toFixed(2)})` : undefined }}>
      <button className="gf-gc-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <PuffyStar brightness={goal.brightness} />
        <div className="gf-gc-mid">
          <div className="gf-gc-badges">
            <span className={cx('gf-chip', `t-${goal.goal_type}`)}>{goal.goal_type}</span>
            {doneToday && <span className="gf-chip gf-chip-ok"><Icon name="check" size={10} stroke={3} /> done today</span>}
            {goal.streak > 0 && <span className="gf-chip gf-chip-flame"><Icon name="flame" size={10} /> {goal.streak}d</span>}
            {goal.streak === 0 && goal.lastStreak && <span className="gf-chip gf-chip-muted">last: {goal.lastStreak}d</span>}
            <span className={cx('gf-chip', goal.deadlineKind === 'over' ? 'gf-chip-over' : goal.deadlineKind === 'soon' ? 'gf-chip-soon' : 'gf-chip-muted')}>{goal.deadline}</span>
          </div>
          <h3 className="gf-gc-title">{goal.smart_title}</h3>
        </div>
        <span className={cx('gf-gc-chev', open && 'is-open')}><Icon name="chevron" size={16} stroke={2.4} /></span>
      </button>

      <div className={cx('gf-gc-collapse', open && 'is-open')}>
        <div>
          <div className="gf-gc-tabs">
            <div className="gf-gc-tabind" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
            {['today', 'sprints', 'history'].map(t => (
              <button key={t} className={cx('gf-gc-tab', tab === t && 'is-on')} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="gf-gc-body" key={tab}>
            {tab === 'today' && <TodayTab goal={goal} onToggle={onToggle} onCelebrate={onCelebrate} />}
            {tab === 'sprints' && <SprintsTab goal={goal} />}
            {tab === 'history' && <HistoryTab goal={goal} />}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

window.GoalCard = GoalCard;
