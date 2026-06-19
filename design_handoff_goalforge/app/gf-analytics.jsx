// gf-analytics.jsx — redesigned Analytics view.
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

// Big-number stat tile (Robinhood/Revolut energy)
function StatTile({ label, value, suffix, accent, spark, trend, progress, progFill, delay, motionOn }) {
  const num = useCountUp(value, { start: motionOn, duration: 1000 });
  return (
    <Reveal className="gf-stat" delay={delay}>
      <div className="gf-stat-label">{label}</div>
      <div className="gf-stat-val" style={{ color: accent }}>{num}{suffix && <span className="gf-stat-suf">{suffix}</span>}</div>
      {spark && <div className="gf-stat-spark"><Sparkline data={spark} color={accent} w={110} h={30} /></div>}
      {trend && <div className={cx('gf-stat-trend', trend.dir)}><Icon name={trend.dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} /> {trend.text}</div>}
      {progress && (
        <div className="gf-stat-prog">
          <div className="gf-stat-prog-track"><div className="gf-stat-prog-fill" style={{ width: `${Math.round(Math.min(1, progress.value) * 100)}%`, background: progFill || accent }} /></div>
          <div className="gf-stat-prog-cap">{progress.label}</div>
        </div>
      )}
    </Reveal>
  );
}

// Three-ring activity card (Apple Fitness)
function ActivityRings({ data, motionOn }) {
  const rings = [
    { label: 'Today', sub: 'tasks done', value: 0.5, color: 'var(--accent)' },
    { label: 'This week', sub: `${data.stats.thisWeek} of 28`, value: data.stats.thisWeek / 28, color: 'var(--ring-2)' },
    { label: 'Consistency', sub: '30-day strength', value: data.stats.consistency, color: 'var(--ring-3)' },
  ];
  return (
    <Reveal className="gf-card gf-rings" delay={80}>
      <div className="gf-card-cap">Activity</div>
      <div className="gf-rings-stack">
        <div className="gf-rings-nest">
          <div style={{ position: 'absolute', inset: 0 }}><Ring value={rings[0].value} size={150} stroke={13} color={rings[0].color} delay={200} fromRatio={0.8} /></div>
          <div style={{ position: 'absolute', inset: 19 }}><Ring value={rings[1].value} size={112} stroke={13} color={rings[1].color} delay={300} fromRatio={0.8} /></div>
          <div style={{ position: 'absolute', inset: 38 }}><Ring value={rings[2].value} size={74} stroke={13} color={rings[2].color} delay={400} fromRatio={0.8} /></div>
        </div>
        <div className="gf-rings-legend">
          {rings.map(r => (
            <div key={r.label} className="gf-legrow">
              <span className="gf-legdot" style={{ background: r.color }} />
              <div>
                <div className="gf-leg-label">{r.label}</div>
                <div className="gf-leg-sub">{r.sub}</div>
              </div>
              <div className="gf-leg-pct" style={{ color: r.color }}>{Math.round(r.value * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// Animated weekly velocity bars
function Velocity({ data, motionOn }) {
  const max = Math.max(...data.velocity.map(d => d.count), 1);
  const [grow, setGrow] = useStateA(!motionOn);
  useEffectA(() => { const id = setTimeout(() => setGrow(true), 240); return () => clearTimeout(id); }, []);
  return (
    <Reveal className="gf-card" delay={140}>
      <div className="gf-card-cap">7-day velocity</div>
      <div className="gf-bars">
        {data.velocity.map((d, i) => (
          <div key={i} className="gf-bar-col">
            <div className="gf-bar-track">
              <div className="gf-bar-grow" style={{ height: `${(d.count / max) * 100 * (grow ? 1 : 0.72)}%`, transitionDelay: `${i * 55}ms` }}>
                <span className="gf-bar-val">{d.count}</span>
              </div>
            </div>
            <span className={cx('gf-bar-lbl', i === data.velocity.length - 1 && 'is-today')}>{d.label}</span>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

// Time-of-day donut
function TimeDonut({ data }) {
  const total = data.timeOfDay.reduce((s, d) => s + d.value, 0);
  const colors = ['var(--accent)', 'var(--ring-2)', 'var(--ring-3)', 'var(--text-mute)'];
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  const [draw, setDraw] = useStateA(false);
  const [active, setActive] = useStateA(-1);
  useEffectA(() => { const id = setTimeout(() => setDraw(true), 260); return () => clearTimeout(id); }, []);
  return (
    <Reveal className="gf-card" delay={180}>
      <div className="gf-card-cap">Time of day</div>
      <div className="gf-donut-wrap">
        <svg className={cx('gf-donut-svg', active >= 0 && 'is-dim')} width="132" height="132" viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
          {data.timeOfDay.map((d, i) => {
            const frac = d.value / total;
            const ratio = draw ? 1 : 0.82; // start mostly drawn, settle the last bit
            const len = c * frac * ratio;
            const seg = (
              <circle key={i} className={cx('gf-donut-seg', active === i && 'is-on')} cx="66" cy="66" r={r} fill="none" stroke={colors[i]}
                strokeWidth={active === i ? 17 : 14}
                strokeDasharray={`${len} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt"
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}
                style={{ transition: `stroke-dasharray .8s cubic-bezier(.22,.61,.36,1) ${i * 70}ms, stroke-width .18s ease, opacity .18s ease` }} />
            );
            acc += c * frac; // always advance by the full arc so positions stay fixed
            return seg;
          })}
        </svg>
        <div className="gf-donut-legend">
          {data.timeOfDay.map((d, i) => (
            <div key={d.name} className={cx('gf-legrow gf-legrow-int', active === i && 'is-active')}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}>
              <span className="gf-legdot" style={{ background: colors[i] }} />
              <div className="gf-leg-label">{d.name}</div>
              <div className="gf-leg-pct">{Math.round((d.value / total) * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// Completion heatmap
// Completion heatmap — GitHub-style contribution grid (months + weekday rows + legend)
const HEAT_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEAT_LEVEL_BG = [
  'var(--ring-track)',
  'color-mix(in oklab, var(--accent) 26%, transparent)',
  'color-mix(in oklab, var(--accent) 48%, transparent)',
  'color-mix(in oklab, var(--accent) 72%, transparent)',
  'var(--accent)',
];
function heatLevel(n) { return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4; }

const HM_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HM_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${HM_DOW[dt.getDay()]}, ${HM_MON[m - 1]} ${d}`;
}

function Heatmap({ data }) {
  const weeks = data.heatmap;          // [{date,count,dow}] × 7, Sun-first
  const nWeeks = weeks.length;
  // Build cells column-by-column (grid-auto-flow:column), rows Mon→Sun.
  const cells = [];
  for (let w = 0; w < nWeeks; w++) {
    for (let r = 0; r < 7; r++) {
      const dow = (r + 1) % 7;          // r0=Mon → dow1 … r6=Sun → dow0
      const d = weeks[w][dow];
      const future = !d || d.count < 0;
      const l = future ? -1 : heatLevel(d.count);
      const tip = future ? '' : `<b>${d.count}</b> task${d.count === 1 ? '' : 's'}<span>${prettyDate(d.date)}</span>`;
      cells.push(
        <span key={w + '-' + r}
          className={cx('hm-cell', future && 'is-empty')}
          style={{ background: future ? 'transparent' : HEAT_LEVEL_BG[l] }}
          onMouseMove={future ? undefined : (e) => gfTip(e, tip)}
          onMouseLeave={future ? undefined : gfHideTip} />
      );
    }
  }
  return (
    <Reveal className="gf-card gf-heat" delay={100}>
      <div className="gf-card-cap">Completion heatmap <span style={{ color: 'var(--text-mute)', textTransform: 'none', letterSpacing: 0 }}>last 4 months</span></div>
      <div className="hm-months">
        {data.monthLabels.map((m, i) => (
          <span key={m.label + i} style={{ marginLeft: i === 0 ? 0 : (m.col - data.monthLabels[i - 1].col) * 17 - 17 }}>{m.label}</span>
        ))}
      </div>
      <div className="hm-wrap">
        <div className="hm-days">
          {HEAT_ROWS.map((dname, i) => <span key={dname}>{i % 2 === 0 ? dname : ''}</span>)}
        </div>
        <div className="hm-grid">{cells}</div>
      </div>
      <div className="hm-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className="hm-cell" style={{ background: HEAT_LEVEL_BG[l] }} />)}
        <span>More</span>
      </div>
    </Reveal>
  );
}

function Reflection() {
  const [well, setWell] = useStateA('');
  const [block, setBlock] = useStateA('');
  const [rating, setRating] = useStateA(4);
  const [saved, setSaved] = useStateA(false);
  return (
    <Reveal className="gf-card" delay={140}>
      <div className="gf-card-cap">Weekly reflection ritual</div>
      <div className="gf-refl">
        <textarea className="gf-textarea" rows={2} placeholder="What went well this week?" value={well} onChange={e => setWell(e.target.value)} />
        <textarea className="gf-textarea" rows={2} placeholder="What blocked you?" value={block} onChange={e => setBlock(e.target.value)} />
        <div className="gf-refl-row">
          <span className="gf-refl-lbl">Week rating</span>
          <div className="gf-stars">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} className={cx('gf-star', n <= rating && 'is-on')} onClick={() => setRating(n)} aria-label={`${n} stars`}><Icon name="spark" size={16} /></button>
            ))}
          </div>
          <button className="gf-btn gf-btn-accent" style={{ marginLeft: 'auto' }} onClick={() => setSaved(true)}>Save</button>
        </div>
        {saved && (
          <div className="gf-coach">
            <div className="gf-coach-cap"><Icon name="spark" size={11} /> AI coach recommendation</div>
            <div className="gf-coach-body">Your mornings are your power zone — 38% of completions happen before noon. Try front-loading the half-marathon mobility work to ride that wave.</div>
          </div>
        )}
      </div>
    </Reveal>
  );
}

function Badges({ data }) {
  return (
    <Reveal className="gf-card" delay={120}>
      <div className="gf-card-cap">Achievement badges</div>
      <div className="gf-badges">
        {data.badges.map(b => (
          <div key={b.key} className={cx('gf-badge', b.unlocked && 'is-on')}>
            <div className="gf-badge-ic"><Icon name={b.unlocked ? 'trophy' : 'target'} size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-badge-title">{b.title}</div>
              <div className="gf-badge-desc">{b.description}</div>
            </div>
            <div className="gf-badge-prog">{Math.min(b.current, b.target)}/{b.target}</div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function HallOfFame({ data }) {
  return (
    <div>
      <Reveal as="div" className="gf-section-cap" delay={60}>Hall of fame · {data.achieved.length} achieved</Reveal>
      <div className="gf-goallist">
        {data.achieved.map((g, i) => (
          <Reveal key={g.id} className="gf-card gf-hof" delay={90 + i * 80}>
            <div className="gf-hof-ic"><Icon name="trophy" size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gf-goal-meta">
                <span className="gf-chip gf-chip-gold">{g.goal_type}</span>
                <span className="gf-chip gf-chip-gold-soft">{g.days} days</span>
              </div>
              <h3 className="gf-hof-title">{g.smart_title}</h3>
              <p className="gf-hof-desc">{g.smart_description}</p>
              <div className="gf-bar gf-bar-gold"><div className="gf-bar-fill" style={{ width: '100%' }} /></div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function Analytics({ data, motionOn }) {
  const diff = data.stats.thisWeek - data.stats.lastWeek;
  const pct = Math.round((diff / data.stats.lastWeek) * 100);
  return (
    <div className="gf-page">
      <Reveal delay={20}>
        <div className="gf-eyebrow">Your patterns</div>
      </Reveal>

      <div className="gf-statgrid">
        <StatTile label="Current streak" value={data.stats.currentStreak} suffix="d" accent="var(--accent)" delay={40} motionOn={motionOn} spark={[2,3,3,5,4,6,7,8,9,12]} />
        <StatTile label="Tasks completed" value={data.stats.tasksCompleted} accent="var(--ring-2)" delay={80} motionOn={motionOn} trend={{ dir: 'up', text: `+${pct}% vs last week` }} />
        <StatTile label="Star points" value={data.stats.starPoints} accent="var(--ring-3)" delay={120} motionOn={motionOn} spark={[4, 5, 5, 7, 8, 8, 10, 12, 15, 18]} />
        <StatTile label="Personal best" value={data.stats.personalBest} suffix="d" accent="var(--text)" delay={160} motionOn={motionOn} progFill="var(--accent)"
          progress={{ value: data.stats.currentStreak / data.stats.personalBest, label: `${data.stats.personalBest - data.stats.currentStreak} days to a new best` }} />
      </div>

      <div className="gf-grid-2">
        <ActivityRings data={data} motionOn={motionOn} />
        <Velocity data={data} motionOn={motionOn} />
      </div>

      <div className="gf-grid-2">
        <Heatmap data={data} />
        <TimeDonut data={data} />
      </div>

      <div className="gf-grid-2">
        <Reflection />
        <Badges data={data} />
      </div>

      <HallOfFame data={data} />
    </div>
  );
}

window.Analytics = Analytics;
