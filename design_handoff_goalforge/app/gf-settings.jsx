// gf-settings.jsx — redesigned Settings page (accountability/invite removed).
const { useState: useSetS, useEffect: useSetE, useRef: useSetR } = React;

// ── Destructive-action confirmation modal ───────────────────────────────────────
// Follows the irreversible-delete pattern: a real modal (not an inline toggle),
// explicit consequences, and a type-to-confirm input that gates the destructive
// button so it can't be triggered by a reflexive double-click.
const DEL_WORD = 'DELETE';
function ConfirmDelete({ open, onClose, onConfirm }) {
  const [text, setText] = useSetS('');
  const [phase, setPhase] = useSetS('idle'); // idle | working | done
  const inputRef = useSetR(null);
  const armed = text.trim().toUpperCase() === DEL_WORD;

  useSetE(() => {
    if (!open) { setText(''); setPhase('idle'); return; }
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
    const onKey = (e) => { if (e.key === 'Escape' && phase === 'idle') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, phase]);

  if (!open) return null;
  const run = () => {
    if (!armed || phase !== 'idle') return;
    setPhase('working');
    setTimeout(() => {
      setPhase('done');
      onConfirm && onConfirm();
      setTimeout(onClose, 1100);
    }, 1150);
  };

  return ReactDOM.createPortal((
    <div className="gf-overlay gf-confirm-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && phase === 'idle') onClose(); }}>
      <div className="gf-confirm" role="alertdialog" aria-modal="true" aria-labelledby="gf-cd-title" aria-describedby="gf-cd-desc">
        {phase === 'done' ? (
          <div className="gf-confirm-done">
            <span className="gf-confirm-done-ic"><Icon name="check" size={26} stroke={3} /></span>
            <h3 className="gf-confirm-title">Account data deleted</h3>
            <p className="gf-confirm-body">Everything has been permanently removed. You'll be signed out shortly.</p>
          </div>
        ) : (
          <>
            <button className="gf-confirm-x" onClick={onClose} disabled={phase !== 'idle'} aria-label="Close"><Icon name="x" size={16} stroke={2.2} /></button>
            <div className="gf-confirm-head">
              <span className="gf-confirm-ic"><Icon name="alert" size={22} /></span>
              <div>
                <h3 className="gf-confirm-title" id="gf-cd-title">Delete account data?</h3>
                <p className="gf-confirm-body" id="gf-cd-desc">This permanently erases your account and <strong>everything in it</strong>. This action cannot be undone.</p>
              </div>
            </div>
            <ul className="gf-confirm-list">
              {['All goals & milestones', 'Every task and its history', 'Streaks, rewards & XP', 'Your profile and preferences'].map(t => (
                <li key={t}><Icon name="trash" size={13} /> {t}</li>
              ))}
            </ul>
            <div className="gf-confirm-field">
              <label htmlFor="gf-cd-input">Type <span className="gf-confirm-word">{DEL_WORD}</span> to confirm</label>
              <input id="gf-cd-input" ref={inputRef} className={cx('gf-confirm-input', armed && 'is-armed')}
                value={text} placeholder={DEL_WORD} autoComplete="off" spellCheck={false}
                disabled={phase !== 'idle'}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && armed) run(); }} />
            </div>
            <div className="gf-confirm-foot">
              <button className="gf-btn gf-btn-soft" onClick={onClose} disabled={phase !== 'idle'}>Cancel</button>
              <button className="gf-btn gf-btn-danger gf-confirm-go" disabled={!armed || phase !== 'idle'} onClick={run}>
                {phase === 'working'
                  ? <><span className="gf-confirm-spin" /> Deleting…</>
                  : <><Icon name="trash" size={14} /> Delete everything</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ), document.querySelector('.gf-root') || document.body);
}

function Field({ label, hint, children }) {
  return (
    <div className="gf-field">
      <label className="gf-field-label">{label}</label>
      {children}
      {hint && <div className="gf-field-hint">{hint}</div>}
    </div>
  );
}

function SettingsSection({ icon, title, subtitle, children, delay, className }) {
  return (
    <Reveal className={cx('gf-card gf-set', className)} delay={delay}>
      <div className="gf-set-head">
        <span className="gf-set-ic"><Icon name={icon} size={16} /></span>
        <div>
          <h3 className="gf-set-title">{title}</h3>
          {subtitle && <p className="gf-set-sub">{subtitle}</p>}
        </div>
      </div>
      <div className="gf-set-body">{children}</div>
    </Reveal>
  );
}

function Settings({ data, themeMode = 'dark', onThemeMode }) {
  const s = data.settings;
  const [name, setName] = useSetS(s.display_name);
  const [remOn, setRemOn] = useSetS(s.reminder_enabled);
  const [hour, setHour] = useSetS(s.reminder_hour);
  const [pushOn, setPushOn] = useSetS(s.push_active > 0);
  const [saved, setSaved] = useSetS(false);
  const [delOpen, setDelOpen] = useSetS(false);
  const [themeOpen, setThemeOpen] = useSetS(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 1600); };

  const THEME_OPTS = [
    { id: 'system', ic: 'monitor', label: 'System' },
    { id: 'light', ic: 'sun', label: 'Light' },
    { id: 'dark', ic: 'moon', label: 'Dark' },
  ];
  const curTheme = THEME_OPTS.find(o => o.id === themeMode) || THEME_OPTS[2];

  return (
    <div className="gf-page gf-settings">
      <Reveal delay={20}>
        <div className="gf-eyebrow">Manage your preferences</div>
      </Reveal>

      {/* Appearance — compact row + dropdown */}
      <SettingsSection icon="sun" title="Appearance" subtitle="Choose how GoalForge looks" delay={40} className="gf-set-overflow">
        <div className="gf-row gf-row-select">
          <div className="gf-row-text">
            <div className="gf-row-title">Theme</div>
            <div className="gf-row-sub">{themeMode === 'system' ? 'Follows your device setting' : `Always ${themeMode}`}</div>
          </div>
          <div className="gf-dd">
            <button className={cx('gf-dd-trigger', themeOpen && 'is-open')} onClick={() => setThemeOpen(o => !o)} aria-haspopup="listbox" aria-expanded={themeOpen}>
              <Icon name={curTheme.ic} size={15} /> <span>{curTheme.label}</span>
              <Icon name="chevron" size={13} stroke={2.4} className="gf-dd-chev" style={{ transform: themeOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
            </button>
            {themeOpen && (
              <>
                <div className="gf-dd-scrim" onClick={() => setThemeOpen(false)} />
                <div className="gf-dd-menu" role="listbox">
                  {THEME_OPTS.map(o => (
                    <button key={o.id} role="option" aria-selected={themeMode === o.id}
                      className={cx('gf-dd-item', themeMode === o.id && 'is-active')}
                      onClick={() => { onThemeMode && onThemeMode(o.id); setThemeOpen(false); }}>
                      <Icon name={o.ic} size={16} /> <span>{o.label}</span>
                      {themeMode === o.id && <Icon name="check" size={14} stroke={3} className="gf-dd-check" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Profile */}
      <SettingsSection icon="spark" title="Profile" subtitle="How you appear in GoalForge" delay={70}>
        <Field label="Display name" hint="Shown in place of your username if set.">
          <input className="gf-input" value={name} maxLength={60} placeholder="Your name (optional)" onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Timezone" hint="Auto-detected from your browser. Updates when you travel.">
          <div className="gf-input gf-input-readonly">
            <Icon name="clock" size={14} /> {s.timezone}
          </div>
        </Field>
      </SettingsSection>

      {/* Reminders */}
      <SettingsSection icon="clock" title="Reminders" subtitle="Stay on track with gentle nudges" delay={90}>
        <div className="gf-row">
          <div className="gf-row-text">
            <div className="gf-row-title">Daily email digest</div>
            <div className="gf-row-sub">A summary of pending tasks, sent each morning.</div>
          </div>
          <Toggle checked={remOn} onChange={setRemOn} label="Daily email digest" />
        </div>
        <div className={cx('gf-row gf-row-stack', !remOn && 'is-disabled')}>
          <div className="gf-row-text">
            <div className="gf-row-title">Reminder hour</div>
            <div className="gf-row-sub">Sent when your local time reaches this hour.</div>
          </div>
          <div className="gf-selectwrap">
            <select className="gf-select" value={hour} disabled={!remOn} onChange={e => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
            </select>
            <span className="gf-select-chev"><Icon name="chevron" size={13} stroke={2.4} style={{ transform: 'rotate(90deg)' }} /></span>
          </div>
        </div>
        <div className="gf-row">
          <div className="gf-row-text">
            <div className="gf-row-title">Browser push notifications</div>
            <div className="gf-row-sub">{pushOn ? '1 active browser subscription' : 'No active subscriptions'}</div>
          </div>
          <Toggle checked={pushOn} onChange={setPushOn} label="Browser push notifications" />
        </div>
      </SettingsSection>

      {/* Save */}
      <Reveal delay={120} className="gf-save-row">
        <button className="gf-btn gf-btn-accent" onClick={save}>{saved ? <><Icon name="check" size={15} stroke={3} /> Saved</> : 'Save settings'}</button>
        {saved && <span className="gf-save-note">Your preferences are up to date.</span>}
      </Reveal>

      {/* Data controls */}
      <SettingsSection icon="gear" title="Data controls" subtitle="Export or permanently remove your data" delay={150}>
        <p className="gf-set-para">Download your full GoalForge data anytime, or permanently delete your account and everything in it.</p>
        <div className="gf-data-btns">
          <button className="gf-btn gf-btn-soft"><Icon name="arrowDown" size={14} /> Export JSON</button>
          <button className="gf-btn gf-btn-soft"><Icon name="arrowDown" size={14} /> Export CSV</button>
        </div>
        <div className="gf-danger">
          <div className="gf-danger-text">
            <div className="gf-danger-title">Delete account data</div>
            <div className="gf-danger-sub">Removes all goals, tasks, milestones and rewards. This cannot be undone.</div>
          </div>
          <button className="gf-btn gf-btn-danger" onClick={() => setDelOpen(true)}>
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      </SettingsSection>

      <ConfirmDelete open={delOpen} onClose={() => setDelOpen(false)} onConfirm={() => {}} />
    </div>
  );
}

window.Settings = Settings;
