import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUser } from '@clerk/react'
import { toast } from 'sonner'
import { useThemeMode, type ThemeMode } from '../lib/ThemeContext'
import Icon from '../components/ui/Icon'
import api from '../lib/api'
import {
  useEnablePushMutation,
  usePushSubscriptionsQuery,
  useSettingsQuery,
  useSaveSettingsMutation,
} from '../hooks'
import type { UserSettings } from '../lib/types'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

const THEME_OPTS: { value: ThemeMode; ic: string; label: string }[] = [
  { value: 'system', ic: 'monitor', label: 'System' },
  { value: 'light',  ic: 'sun',     label: 'Light' },
  { value: 'dark',   ic: 'moon',    label: 'Dark' },
]

const DEL_WORD = 'DELETE'

// ── Confirm Delete modal ───────────────────────────────────────────────────────
function ConfirmDelete({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'working'>('idle')
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
      // onConfirm handles redirect; if it throws we reset
    } catch {
      setPhase('idle')
    }
  }

  return createPortal(
    <div
      className="gf-overlay gf-confirm-scrim"
      onMouseDown={e => { if (e.target === e.currentTarget && phase === 'idle') onClose() }}
    >
      <div
        className="gf-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gf-cd-title"
        aria-describedby="gf-cd-desc"
      >
        <button
          className="gf-confirm-x"
          onClick={onClose}
          disabled={phase !== 'idle'}
          aria-label="Close"
        >
          <Icon name="x" size={16} stroke={2.2} />
        </button>
        <div className="gf-confirm-head">
          <span className="gf-confirm-ic"><Icon name="alert" size={22} /></span>
          <div>
            <h3 className="gf-confirm-title" id="gf-cd-title">Delete account data?</h3>
            <p className="gf-confirm-body" id="gf-cd-desc">
              This permanently erases your account and <strong>everything in it</strong>. This action cannot be undone.
            </p>
          </div>
        </div>
        <ul className="gf-confirm-list">
          {['All goals & milestones', 'Every task and its history', 'Streaks, rewards & XP', 'Your profile and preferences'].map(item => (
            <li key={item}><Icon name="trash" size={13} /> {item}</li>
          ))}
        </ul>
        <div className="gf-confirm-field">
          <label htmlFor="gf-cd-input">
            Type <span className="gf-confirm-word">{DEL_WORD}</span> to confirm
          </label>
          <input
            id="gf-cd-input"
            ref={inputRef}
            className={cx('gf-confirm-input', armed && 'is-armed')}
            value={text}
            placeholder={DEL_WORD}
            autoComplete="off"
            spellCheck={false}
            disabled={phase !== 'idle'}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && armed) { void run() } }}
          />
        </div>
        <div className="gf-confirm-foot">
          <button className="gf-btn gf-btn-soft" onClick={onClose} disabled={phase !== 'idle'}>
            Cancel
          </button>
          <button
            className="gf-btn gf-btn-danger gf-confirm-go"
            disabled={!armed || phase !== 'idle'}
            onClick={() => { void run() }}
          >
            {phase === 'working'
              ? <><span className="gf-confirm-spin" /> Deleting…</>
              : <><Icon name="trash" size={14} /> Delete everything</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Section shell ─────────────────────────────────────────────────────────────
function SetSection({ icon, title, subtitle, children, className }: {
  icon: string; title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cx('gf-card gf-set', className)}>
      <div className="gf-set-head">
        <span className="gf-set-ic">{icon}</span>
        <div>
          <div className="gf-set-title">{title}</div>
          {subtitle && <div className="gf-set-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="gf-set-body">{children}</div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="gf-switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="gf-switch-track" />
      <span className="gf-switch-thumb" />
    </label>
  )
}

// ── DataControls ──────────────────────────────────────────────────────────────
function DataControls({ userId }: { userId: string }) {
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
    <SetSection icon="⚙️" title="Data controls" subtitle="Export or permanently remove your data">
      <p className="gf-set-para">Download your full GoalForge data anytime, or permanently delete your account and everything in it.</p>
      <div className="gf-data-btns">
        <button onClick={() => { void exportData('json') }} disabled={busy} className="gf-btn gf-btn-soft">
          <Icon name="arrowDown" size={14} /> {isExporting === 'json' ? 'Exporting…' : 'Export JSON'}
        </button>
        <button onClick={() => { void exportData('csv') }} disabled={busy} className="gf-btn gf-btn-soft">
          <Icon name="arrowDown" size={14} /> {isExporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      <div className="gf-danger">
        <div className="gf-danger-text">
          <div className="gf-danger-title">Delete account data</div>
          <div className="gf-danger-sub">Removes all goals, tasks, milestones and rewards. This cannot be undone.</div>
        </div>
        <button onClick={() => setDelOpen(true)} disabled={busy} className="gf-btn gf-btn-danger">
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
      <ConfirmDelete
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={deleteAllData}
      />
    </SetSection>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────
function SettingsForm({ settings, userId }: { settings: UserSettings; userId: string }) {
  const { save: saveSettings, isSaving: saving } = useSaveSettingsMutation(userId)
  const { subscriptions } = usePushSubscriptionsQuery(userId)
  const { enablePush, isEnabling } = useEnablePushMutation(userId)

  const [displayName, setDisplayName] = useState(settings.display_name ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(settings.reminder_enabled)
  const [reminderHour, setReminderHour] = useState(settings.reminder_hour)
  const [saved, setSaved] = useState(false)

  function save() {
    if (saving) return
    saveSettings({
      display_name: displayName.trim() || null,
      reminder_enabled: reminderEnabled,
      reminder_hour: reminderHour,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="gf-page">

      {/* Profile */}
      <SetSection icon="✦" title="Profile" subtitle="How you appear in GoalForge">
        <div className="gf-field">
          <label className="gf-field-label">Display name</label>
          <input
            className="gf-input"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name (optional)"
            maxLength={60}
          />
          <div className="gf-field-hint">Shown in place of your username if set.</div>
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Timezone</label>
          <div className="gf-input gf-input-readonly">
            {settings.timezone}
          </div>
          <div className="gf-field-hint">Auto-detected from your browser. Updates when you travel.</div>
        </div>
      </SetSection>

      {/* Reminders */}
      <SetSection icon="🔔" title="Reminders" subtitle="Stay on track with gentle nudges">
        <div className="gf-row">
          <div>
            <div className="gf-row-title">Daily email digest</div>
            <div className="gf-row-sub">A summary of pending tasks, sent each morning.</div>
          </div>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} label="Daily email digest" />
        </div>
        <div className={['gf-row', !reminderEnabled && 'is-disabled'].filter(Boolean).join(' ')}>
          <div>
            <div className="gf-row-title">Reminder hour</div>
            <div className="gf-row-sub">Sent when your local time reaches this hour.</div>
          </div>
          <div className="gf-selectwrap">
            <select
              className="gf-select"
              value={reminderHour}
              disabled={!reminderEnabled}
              onChange={e => setReminderHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
            <span className="gf-select-chev" aria-hidden="true"><Icon name="chevronDown" size={13} /></span>
          </div>
        </div>
        <div className="gf-row">
          <div>
            <div className="gf-row-title">Browser push notifications</div>
            <div className="gf-row-sub">
              {subscriptions.filter(s => s.is_active).length} active subscription{subscriptions.filter(s => s.is_active).length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={() => enablePush()} disabled={isEnabling} className="gf-btn-ghost-indigo">
            {isEnabling ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      </SetSection>

      {/* Save */}
      <div className="gf-save-row">
        <button
          onClick={save}
          disabled={saving}
          className="gf-btn gf-btn-accent"
          style={saving ? { opacity: 0.6 } : undefined}
        >
          {saved ? '✓ Saved' : saving ? '···' : 'Save settings'}
        </button>
        {saved && <span className="gf-save-note">Your preferences are up to date.</span>}
      </div>

      <DataControls userId={userId} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useUser()
  const userId = user?.id
  const { mode, setMode } = useThemeMode()
  const [themeOpen, setThemeOpen] = useState(false)

  const { settings, isLoading: loading, isError } = useSettingsQuery(userId)

  useEffect(() => { document.title = 'Settings — GoalForge' }, [])

  const curTheme = THEME_OPTS.find(o => o.value === mode) ?? THEME_OPTS[2]
  const themeCaption = mode === 'system' ? 'Follows your device setting' : `Always ${mode}`

  return (
    <div className="gf-settings gf-page">

        {/* Eyebrow */}
        <div className="gf-eyebrow">Manage your preferences</div>

        {/* Appearance — dropdown variant */}
        <SetSection
          icon="☀️"
          title="Appearance"
          subtitle="Choose how GoalForge looks"
          className="gf-set-overflow"
        >
          <div className="gf-row gf-row-select">
            <div>
              <div className="gf-row-title">Theme</div>
              <div className="gf-row-sub">{themeCaption}</div>
            </div>
            <div className="gf-dd">
              <button
                className={cx('gf-dd-trigger', themeOpen && 'is-open')}
                onClick={() => setThemeOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={themeOpen}
              >
                <Icon name={curTheme.ic} size={15} />
                <span>{curTheme.label}</span>
                <Icon
                  name="chevron"
                  size={13}
                  stroke={2.4}
                  className="gf-dd-chev"
                  style={{ transform: themeOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }}
                />
              </button>
              {themeOpen && (
                <>
                  <div className="gf-dd-scrim" onClick={() => setThemeOpen(false)} />
                  <div className="gf-dd-menu" role="listbox">
                    {THEME_OPTS.map(o => (
                      <button
                        key={o.value}
                        role="option"
                        aria-selected={mode === o.value}
                        className={cx('gf-dd-item', mode === o.value && 'is-active')}
                        onClick={() => { setMode(o.value); setThemeOpen(false) }}
                      >
                        <Icon name={o.ic} size={16} />
                        <span>{o.label}</span>
                        {mode === o.value && <Icon name="check" size={14} stroke={3} className="gf-dd-check" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </SetSection>

        {/* Loading */}
        {loading && (
          <div role="status" aria-label="Loading settings" className="gf-spinner-wrap">
            <div className="gf-spinner" />
          </div>
        )}

        {/* Error */}
        {!loading && isError && (
          <div className="gf-nudge" style={{
            '--accent': 'var(--rose)',
            '--accent-soft': 'color-mix(in oklab, var(--rose) 10%, transparent)',
            '--accent-line': 'color-mix(in oklab, var(--rose) 32%, transparent)',
            '--accent-ink': 'var(--rose)',
            marginTop: 16,
          } as React.CSSProperties}>
            <div>
              <div className="gf-nudge-kicker">Load error</div>
              <div className="gf-nudge-title">Failed to load settings.</div>
            </div>
          </div>
        )}

        {/* Form */}
        {!loading && !isError && settings && userId && (
          <SettingsForm settings={settings} userId={userId} />
        )}
    </div>
  )
}
