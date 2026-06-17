// gf-dashboard.jsx — redesigned Dashboard: compact greeting + goal-creation hero + goal cards.
const { useState: useStateD, useEffect: useEffectD, useRef: useRefD } = React;

// ── Compact greeting strip ──────────────────────────────────────────────────────
function GreetingStrip({ data }) {
  const allTasks = data.goals.flatMap(g => g.tasks);
  const done = allTasks.filter(t => t.done).length;
  const total = allTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Reveal className="gf-greet" delay={0}>
      <div className="gf-greet-l">
        <img src="assets/waving-hand.svg" alt="" className="gf-greet-wave" width={34} height={34} />
        <div>
          <div className="gf-greet-hi">{data.greeting}, {data.profile.name}</div>
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
    </Reveal>
  );
}

// ── Typewriter placeholder ───────────────────────────────────────────────────────
const TYPE_EXAMPLES = ['run a 5k in 8 weeks', 'ship my side project this month', 'read 12 books this year', 'learn Spanish in 6 months', 'wake up at 6am every day', 'save $5,000 by August'];
function useTypewriter(active) {
  const [txt, setTxt] = useStateD('');
  const st = useRefD({ i: 0, del: false });
  useEffectD(() => {
    if (!active) return;
    let timer;
    const tick = () => {
      const s = st.current; const cur = TYPE_EXAMPLES[s.i];
      if (!s.del && txt === cur) { timer = setTimeout(() => { s.del = true; tick2(); }, 1900); return; }
      if (s.del && txt === '') { s.del = false; s.i = (s.i + 1) % TYPE_EXAMPLES.length; timer = setTimeout(tick2, 360); return; }
      const nx = s.del ? cur.slice(0, txt.length - 1) : cur.slice(0, txt.length + 1);
      timer = setTimeout(() => setTxt(nx), s.del ? 34 : 70);
    };
    const tick2 = () => setTxt(t => t); // nudge
    tick();
    return () => clearTimeout(timer);
  }, [txt, active]);
  return txt;
}

// ── Goal-creation hero (the centerpiece) ─────────────────────────────────────────
const CATEGORY_CHIPS = [
  { ic: 'run', label: 'Get fit', prompt: 'Build a consistent workout habit and lose 10 pounds over 3 months' },
  { ic: 'book', label: 'Learn something', prompt: 'Learn Spanish from scratch and hold a basic conversation in 6 months' },
  { ic: 'bolt', label: 'Financial goal', prompt: 'Save $5,000 in an emergency fund over the next 6 months' },
  { ic: 'spark', label: 'Creative project', prompt: 'Write the first draft of a short novel in 90 days' },
  { ic: 'heart', label: 'Wellness', prompt: 'Meditate for at least 10 minutes every day for 30 days' },
];

function GoalCreation({ onCreate }) {
  const [value, setValue] = useStateD('');
  const [focused, setFocused] = useStateD(false);
  const [status, setStatus] = useStateD('idle');
  const typed = useTypewriter(!focused && !value);

  const submit = () => {
    if (!value.trim() || status === 'thinking') return;
    setStatus('thinking');
    onCreate && onCreate();
    setTimeout(() => { setStatus('done'); setTimeout(() => { setStatus('idle'); setValue(''); }, 1100); }, 1100);
  };

  return (
    <div className="gf-create-wrap">
      <div className="gf-create-amb" aria-hidden="true">
        <span className="gf-amb o1" /><span className="gf-amb o2" /><span className="gf-amb o3" /><span className="gf-amb o4" />
      </div>
      <Reveal className={cx('gf-create', focused && 'is-focus')} delay={60}>
      <div className="gf-create-bg" />
      <div className="gf-create-blob a" />
      <div className="gf-create-blob b" />
      <div className="gf-create-in">
        <div className="gf-create-eyebrow">What’s your next goal?</div>
        <div className="gf-create-pillwrap">
          <div className="gf-create-pill">
            <span className="gf-create-star"><Icon name="spark" size={17} /></span>
            <div className="gf-create-field">
              <input className="gf-create-input" value={value} onChange={e => setValue(e.target.value)}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }} aria-label="Describe your goal" />
              {!value && (
                <div className="gf-create-ph">{focused ? <span className="dim">Describe a goal…</span> : <>e.g.&nbsp;{typed}<span className="gf-caret">|</span></>}</div>
              )}
            </div>
            <button className={cx('gf-create-go', value.trim() && 'is-on')} onClick={submit} aria-label="Create goal">
              {status === 'thinking' ? <span className="gf-create-dots">···</span> : <Icon name="arrowUp" size={18} stroke={2.4} />}
            </button>
          </div>
        </div>
        <div className="gf-create-chips">
          {CATEGORY_CHIPS.map(c => (
            <button key={c.label} className="gf-create-chip" onClick={() => setValue(c.prompt)}>
              <Icon name={c.ic} size={13} /> {c.label}
            </button>
          ))}
        </div>
        {status === 'thinking' && <div className="gf-create-status think">◉ AI is forging your plan…</div>}
        {status === 'done' && <div className="gf-create-status done"><Icon name="check" size={12} stroke={3} /> Goal added!</div>}
      </div>
    </Reveal>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────────
function Dashboard({ data, onCelebrate }) {
  const [goals, setGoals] = useStateD(data.goals);
  const [filter, setFilter] = useStateD('active');

  const toggle = (gid, tid, bucket) => {
    setGoals(gs => gs.map(g => g.id === gid ? { ...g, [bucket]: g[bucket].map(t => t.id === tid ? { ...t, done: !t.done } : t) } : g));
  };
  const counts = { active: goals.length, achieved: data.achieved.length, abandoned: 0 };
  const listFor = (f) => f === 'achieved' ? data.achieved : f === 'active' ? goals : [];

  return (
    <div className="gf-page">
      <GreetingStrip data={{ ...data, goals }} />
      <GoalCreation onCreate={onCelebrate} />

      <div className="gf-listhead">
        <Reveal as="h2" className="gf-h2" delay={40}>Your goals</Reveal>
        <Reveal delay={60}>
          <Segmented options={['active', 'achieved', 'abandoned']} value={filter} onChange={setFilter} getLabel={o => `${o} ${counts[o]}`} />
        </Reveal>
      </div>

      <Switcher value={filter}>
        {(shown) => {
          const list = listFor(shown);
          return list.length === 0 ? (
            <div className="gf-empty">
              <div className="gf-empty-ic"><Icon name="trophy" size={26} /></div>
              <div className="gf-empty-t">{shown === 'abandoned' ? 'Nothing abandoned — you’re holding the line.' : 'No goals here yet.'}</div>
            </div>
          ) : (
            <div className="gf-goallist">
              {list.map((g, i) => (
                <GoalCard key={g.id} goal={g} index={i} onToggle={toggle} onCelebrate={onCelebrate} defaultOpen={i === 0 && shown === 'active'} />
              ))}
            </div>
          );
        }}
      </Switcher>
    </div>
  );
}

window.Dashboard = Dashboard;
