// pages/SettingsPage.tsx — Settings page: appearance, profile, reminders, data
// controls. Transcribed from design_handoff_goalforge/app/gf-settings.jsx.
// Mock data.settings is replaced with real hooks: useSettingsQuery/
// useSaveSettingsMutation, usePushSubscriptionsQuery/useEnablePushMutation,
// ThemeContext (theme dropdown), Clerk useUser (sign-out lives in AppShell's
// UserButton — the prototype has no sign-out control on this page). The
// prototype's tweaks panel (accent/font/density) is never ported — see
// CLAUDE.md locked design decisions. Accountability section intentionally
// absent (prototype has none; full code deletion happens separately).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUser } from '@clerk/react'
import { toast } from 'sonner'
import { cx, Icon, Reveal, Toggle } from '../components/gf/Ui'
import { useThemeMode, type ThemeMode } from '../lib/ThemeContext'
import api from '../lib/api'
import {
  useEnablePushMutation,
  usePushSubscriptionsQuery,
  useSaveSettingsMutation,
  useSettingsQuery,
} from '../hooks'
import type { UserSettings } from '../lib/types'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

const DEL_WORD = 'DELETE'

// ── Destructive-action confirmation modal ───────────────────────────────────
// Follows the irreversible-delete pattern: a real modal (not an inline
// toggle), explicit consequences, and a type-to-confirm input that gates the
// destructive button so it can't be triggered by a reflexive double-click.
function ConfirmDelete({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const armed = text.trim().toUpperCase() === DEL_WORD

  useEffect(() => {
    if (!open) { setText(''); setPhase('idle'); return }
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase === 'idle') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, phase, onClose])

  if (!open) return null

  async function run() {
    if (!armed || phase !== 'idle') return
    setPhase('working')
    try {
      await onConfirm()
      setPhase('done')
      setTimeout(onClose, 1100)
    } catch {
      setPhase('idle')
    }
  }

  return createPortal((
    <div className="gf-overlay gf-confirm-scrim" onMouseDown={e => { if (e.target === e.currentTarget && phase === 'idle') onClose() }}>
      <div className="gf-confirm" role="alertdialog" aria-modal="true" aria-labelledby="gf-cd-title" aria-describedby="gf-cd-desc">
        {phase === 'done' ? (
          <div className="gf-confirm-done">
            <span className="gf-confirm-done-ic"><Icon name="check" size={26} stroke={3} /></span>
            <h3 className="gf-confirm-title">Account data deleted</h3>
            <p className="gf-confirm-body">Everything has been permanently removed. You&apos;ll be signed out shortly.</p>
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
                onKeyDown={e => { if (e.key === 'Enter' && armed) void run() }} />
            </div>
            <div className="gf-confirm-foot">
              <button className="gf-btn gf-btn-soft" onClick={onClose} disabled={phase !== 'idle'}>Cancel</button>
              <button className="gf-btn gf-btn-danger gf-confirm-go" disabled={!armed || phase !== 'idle'} onClick={() => void run()}>
                {phase === 'working'
                  ? <><span className="gf-confirm-spin" /> Deleting…</>
                  : <><Icon name="trash" size={14} /> Delete everything</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ), document.querySelector('.gf-root') ?? document.body)
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="gf-field">
      <label className="gf-field-label">{label}</label>
      {children}
      {hint && <div className="gf-field-hint">{hint}</div>}
    </div>
  )
}

function SettingsSection({
  icon, title, subtitle, children, delay, className,
}: { icon: string; title: string; subtitle?: string; children: React.ReactNode; delay?: number; className?: string }) {
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
  )
}

// ── Appearance — theme dropdown (only prototype-driven appearance control) ──
const THEME_OPTS: { id: ThemeMode; ic: string; label: string }[] = [
  { id: 'system', ic: 'monitor', label: 'System' },
  { id: 'light', ic: 'sun', label: 'Light' },
  { id: 'dark', ic: 'moon', label: 'Dark' },
]

function Appearance() {
  const { mode, setMode } = useThemeMode()
  const [themeOpen, setThemeOpen] = useState(false)
  const curTheme = THEME_OPTS.find(o => o.id === mode) ?? THEME_OPTS[2]

  return (
    <SettingsSection icon="sun" title="Appearance" subtitle="Choose how GoalForge looks" delay={40} className="gf-set-overflow">
      <div className="gf-row gf-row-select">
        <div className="gf-row-text">
          <div className="gf-row-title">Theme</div>
          <div className="gf-row-sub">{mode === 'system' ? 'Follows your device setting' : `Always ${mode}`}</div>
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
                  <button key={o.id} role="option" aria-selected={mode === o.id}
                    className={cx('gf-dd-item', mode === o.id && 'is-active')}
                    onClick={() => { setMode(o.id); setThemeOpen(false) }}>
                    <Icon name={o.ic} size={16} /> <span>{o.label}</span>
                    {mode === o.id && <Icon name="check" size={14} stroke={3} className="gf-dd-check" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}

// ── Profile + Reminders + Save (settings-backed form) ───────────────────────
function SettingsForm({ settings, userId }: { settings: UserSettings; userId: string }) {
  const { save, isSaving } = useSaveSettingsMutation(userId)
  const { subscriptions } = usePushSubscriptionsQuery(userId)
  const { enablePush, isEnabling } = useEnablePushMutation(userId)

  const [name, setName] = useState(settings.display_name ?? '')
  const [remOn, setRemOn] = useState(settings.reminder_enabled)
  const [hour, setHour] = useState(settings.reminder_hour)
  const [saved, setSaved] = useState(false)

  const pushOn = subscriptions.some(s => s.is_active)

  const onSave = () => {
    if (isSaving) return
    save({ display_name: name.trim() || null, reminder_enabled: remOn, reminder_hour: hour })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const onTogglePush = (next: boolean) => {
    // No unsubscribe endpoint exists yet — enabling is the only real action;
    // turning the switch off with no active subscription is a no-op.
    if (next && !isEnabling) enablePush()
  }

  return (
    <>
      {/* Profile */}
      <SettingsSection icon="spark" title="Profile" subtitle="How you appear in GoalForge" delay={70}>
        <Field label="Display name" hint="Shown in place of your username if set.">
          <input className="gf-input" value={name} maxLength={60} placeholder="Your name (optional)" onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Timezone" hint="Auto-detected from your browser. Updates when you travel.">
          <div className="gf-input gf-input-readonly">
            <Icon name="clock" size={14} /> {settings.timezone}
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
          <Toggle checked={pushOn} onChange={onTogglePush} label="Browser push notifications" />
        </div>
      </SettingsSection>

      {/* Save */}
      <Reveal delay={120} className="gf-save-row">
        <button className="gf-btn gf-btn-accent" onClick={onSave} disabled={isSaving}>
          {saved ? <><Icon name="check" size={15} stroke={3} /> Saved</> : 'Save settings'}
        </button>
        {saved && <span className="gf-save-note">Your preferences are up to date.</span>}
      </Reveal>
    </>
  )
}

// ── Data controls — export + delete ─────────────────────────────────────────
function DataControls({ userId, delay }: { userId: string; delay?: number }) {
  const [isExporting, setIsExporting] = useState<null | 'json' | 'csv'>(null)
  const [delOpen, setDelOpen] = useState(false)
  const busy = !!isExporting

  async function exportData(format: 'json' | 'csv') {
    if (busy) return
    setIsExporting(format)
    try {
      const response = await api.get(`/users/${userId}/export`, { params: { format }, responseType: 'blob' })
      const datePart = new Intl.DateTimeFormat('en-CA').format(new Date())
      const blob = new Blob([response.data], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `goalforge-export-${datePart}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Could not export data. Please try again.')
    } finally {
      setIsExporting(null)
    }
  }

  async function deleteAllData() {
    try {
      await api.delete(`/users/${userId}`)
      toast.success('Account data deleted')
      window.location.href = '/'
    } catch {
      toast.error('Could not delete account data. Please try again.')
      throw new Error('delete failed')
    }
  }

  return (
    <SettingsSection icon="gear" title="Data controls" subtitle="Export or permanently remove your data" delay={delay}>
      <p className="gf-set-para">Download your full GoalForge data anytime, or permanently delete your account and everything in it.</p>
      <div className="gf-data-btns">
        <button className="gf-btn gf-btn-soft" disabled={busy} onClick={() => void exportData('json')}>
          <Icon name="arrowDown" size={14} /> {isExporting === 'json' ? 'Exporting…' : 'Export JSON'}
        </button>
        <button className="gf-btn gf-btn-soft" disabled={busy} onClick={() => void exportData('csv')}>
          <Icon name="arrowDown" size={14} /> {isExporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      <div className="gf-danger">
        <div className="gf-danger-text">
          <div className="gf-danger-title">Delete account data</div>
          <div className="gf-danger-sub">Removes all goals, tasks, milestones and rewards. This cannot be undone.</div>
        </div>
        <button className="gf-btn gf-btn-danger" disabled={busy} onClick={() => setDelOpen(true)}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>

      <ConfirmDelete open={delOpen} onClose={() => setDelOpen(false)} onConfirm={deleteAllData} />
    </SettingsSection>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { settings, isLoading, isError } = useSettingsQuery(userId)

  useEffect(() => { document.title = 'Settings — GoalForge' }, [])

  return (
    <div className="gf-page gf-settings">
      <Reveal delay={20}>
        <div className="gf-eyebrow">Manage your preferences</div>
      </Reveal>

      <Appearance />

      {isLoading && (
        <div role="status" aria-label="Loading settings" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ring-track)', borderTop: '2px solid var(--accent)', animation: 'spin 0.75s linear infinite' }} />
        </div>
      )}
      {!isLoading && isError && (
        <Reveal className="gf-nudge is-rose" delay={70}>
          <div className="gf-nudge-body">
            <div className="gf-nudge-kicker">Load error</div>
            <div className="gf-nudge-title">Failed to load settings.</div>
          </div>
        </Reveal>
      )}
      {!isLoading && !isError && settings && userId && (
        <>
          <SettingsForm settings={settings} userId={userId} />
          <DataControls userId={userId} delay={150} />
        </>
      )}
    </div>
  )
}
