// gf-app.jsx — shell: header, nav, theme tokens, tweaks, confetti, focus overlay.
const { useState: useS, useEffect: useE, useRef: useR, useCallback } = React;

const ACCENTS = ['#ff6a3d', '#7c6bff', '#34d399', '#38bdf8'];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "themeMode": "dark",
  "accent": "#ff6a3d",
  "createStyle": "glass",
  "font": "modern",
  "motion": "rich",
  "density": "cozy",
  "radius": 20
}/*EDITMODE-END*/;

// ── Confetti (lightweight DOM burst) ──────────────────────────────────────────
function burst(colors) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.getElementById('gf-confetti');
  if (!layer) return;
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span');
    s.className = 'gf-confetto';
    const ang = Math.random() * Math.PI * 2;
    const vel = 90 + Math.random() * 200;
    s.style.background = colors[i % colors.length];
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * vel + 'px');
    s.style.setProperty('--dy', (Math.sin(ang) * vel - 120) + 'px');
    s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    s.style.width = s.style.height = (5 + Math.random() * 6) + 'px';
    if (Math.random() > 0.5) s.style.borderRadius = '50%';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}

// ── Focus overlay ─────────────────────────────────────────────────────────────
function FocusOverlay({ open, onClose, goals, onCelebrate }) {
  const [tasks, setTasks] = useS(() => goals.flatMap(g => g.tasks.filter(t => !t.done).map(t => ({ ...t, goal: g.smart_title }))));
  useE(() => { const h = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  if (!open) return null;
  const remaining = tasks.filter(t => !t.done).length;
  const toggle = (id) => { const t = tasks.find(x => x.id === id); if (t && !t.done) onCelebrate(); setTasks(ts => ts.map(x => x.id === id ? { ...x, done: !x.done } : x)); };
  return (
    <div className="gf-overlay" onClick={onClose}>
      <div className="gf-focus" onClick={e => e.stopPropagation()}>
        <div className="gf-focus-head">
          <div>
            <div className="gf-eyebrow">Focus mode</div>
            <h2 className="gf-h2">{remaining ? `${remaining} task${remaining > 1 ? 's' : ''} between you and done` : 'All clear. Go celebrate.'}</h2>
          </div>
          <button className="gf-nudge-x" onClick={onClose} aria-label="Close"><Icon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="gf-focus-list">
          {tasks.map(t => (
            <button key={t.id} className={cx('gf-focus-task', t.done && 'is-done')} onClick={() => toggle(t.id)}>
              <span className="gf-check gf-check-lg"><Icon name="check" size={16} stroke={3} /></span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span className="gf-focus-task-title">{t.title}</span>
                <span className="gf-focus-task-goal">{t.goal}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'stars', label: 'Logs', icon: 'spark' },
  { id: 'coach', label: 'Chat', icon: 'chat' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

function Header({ tab, setTab, data }) {
  const wrap = useR(null);
  const [pill, setPill] = useS({ left: 0, width: 0, ready: false });
  const [menuOpen, setMenuOpen] = useS(false);
  useE(() => {
    const el = wrap.current?.querySelector(`[data-nav="${tab}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [tab]);
  useE(() => {
    const onResize = () => { if (window.innerWidth > 700) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); };
  }, []);
  const pick = (id) => { setTab(id); setMenuOpen(false); };
  return (
    <header className="gf-header">
      <div className="gf-header-in">
        <div className="gf-logo">Goal<span>Forge</span></div>
        <nav className="gf-nav" ref={wrap}>
          <div className="gf-nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }} />
          {NAV.map(n => (
            <button key={n.id} data-nav={n.id} className={cx('gf-nav-btn', tab === n.id && 'is-active')} onClick={() => setTab(n.id)}>
              <Icon name={n.icon} size={15} /><span className="gf-nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="gf-header-right">
          <button className="gf-pts" onClick={() => setTab('analytics')}>
            <Icon name="spark" size={12} /> <span className="gf-pts-stage">{data.stage.name}</span>
          </button>
          <div className="gf-avatar">{data.profile.name[0]}</div>
          <button className={cx('gf-burger', menuOpen && 'is-open')} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      {menuOpen && <div className="gf-navmenu-scrim" onClick={() => setMenuOpen(false)} />}
      <div className={cx('gf-navmenu', menuOpen && 'is-open')}>
        {NAV.map(n => (
          <button key={n.id} className={cx('gf-navmenu-btn', tab === n.id && 'is-active')} onClick={() => pick(n.id)}>
            <Icon name={n.icon} size={18} /><span>{n.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}

// ── Page switcher: smooth exit \u2192 enter cross-fade between tabs ──────────────────
function Placeholder({ name }) {
  return (
    <div className="gf-placeholder">
      <Mascot stageId={3} size={84} />
      <h2 className="gf-h2" style={{ marginTop: 18 }}>{name}</h2>
      <p className="gf-hero-sub" style={{ maxWidth: 360 }}>This screen keeps its current functionality — the redesign pass starts with Dashboard and Analytics. Flip back to see the new system in action.</p>
      <Segmented options={['dashboard', 'analytics']} value="dashboard" onChange={() => {}} getLabel={o => o} />
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────────
function useSystemDark() {
  const [dark, setDark] = useS(() => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  useE(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e) => setDark(e.matches);
    mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', h) : mq.removeListener(h); };
  }, []);
  return dark;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const data = window.GF_DATA;
  const [tab, setTab] = useS('dashboard');
  const sysDark = useSystemDark();
  const themeMode = t.themeMode || 'dark';
  const theme = themeMode === 'system' ? (sysDark ? 'dark' : 'light') : themeMode;

  const accentList = (() => { const a = [t.accent, ...ACCENTS.filter(c => c !== t.accent)]; return a; })();
  const celebrate = useCallback(() => burst([t.accent, '#34d399', '#fbbf24', '#7c6bff']), [t.accent]);

  // apply tokens to root
  const rootStyle = {
    '--accent': t.accent,
    '--radius': `${t.radius}px`,
  };

  useE(() => { document.title = 'GoalForge — Redesign'; }, []);

  return (
    <div className="gf-root" data-theme={theme} data-font={t.font} data-motion={t.motion} data-density={t.density} data-create={t.createStyle || 'aurora'} style={rootStyle}>
      <Header tab={tab} setTab={setTab} data={data} />

      <main className="gf-main">
        <Switcher value={tab} scrollTop={true}>
          {(shown) => (
            <React.Fragment>
              {shown === 'dashboard' && <Dashboard key="dash" data={data} onCelebrate={celebrate} />}
              {shown === 'analytics' && <Analytics key="ana" data={data} motionOn={true} />}
              {shown === 'stars' && <Stars key="stars" data={data} onCelebrate={celebrate} />}
              {shown === 'settings' && <Settings key="set" data={data} themeMode={themeMode} onThemeMode={(v) => setTweak('themeMode', v)} />}
              {shown === 'coach' && <Coach key="coach" data={data} onCelebrate={celebrate} />}
            </React.Fragment>
          )}
        </Switcher>
      </main>

      <div id="gf-confetti" />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={themeMode} options={['system', 'light', 'dark']} onChange={v => setTweak('themeMode', v)} />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS} onChange={v => setTweak('accent', v)} />
        <TweakRadio label="Goal box" value={t.createStyle || 'aurora'} options={['aurora', 'glass']} onChange={v => setTweak('createStyle', v)} />
        <TweakSection label="Type" />
        <TweakRadio label="Pairing" value={t.font} options={['modern', 'editorial']} onChange={v => setTweak('font', v)} />
        <TweakSection label="Feel" />
        <TweakRadio label="Motion" value={t.motion} options={['subtle', 'rich', 'playful']} onChange={v => setTweak('motion', v)} />
        <TweakRadio label="Density" value={t.density} options={['cozy', 'compact']} onChange={v => setTweak('density', v)} />
        <TweakSlider label="Roundness" value={t.radius} min={8} max={28} step={2} unit="px" onChange={v => setTweak('radius', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
