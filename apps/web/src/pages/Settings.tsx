import { useState, useEffect } from 'react'
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

const THEME_OPTS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

// ── Section shell ─────────────────────────────────────────────────────────────
function SetSection({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="gf-card gf-set">
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
  const [isDeleting, setIsDeleting] = useState(false)
  const busy = !!isExporting || isDeleting

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
    if (busy) return
    const confirmed = window.confirm(
      'This permanently deletes your GoalForge data (goals, tasks, milestones, rewards). Continue?'
    )
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await api.delete(`/users/${userId}`)
      toast.success('Account data deleted')
      window.location.href = '/'
    } catch {
      toast.error('Could not delete account data. Please try again.')
      setIsDeleting(false)
    }
  }

  return (
    <SetSection icon="⚙️" title="Data controls" subtitle="Export or permanently remove your data">
      <p className="gf-set-para">Download your full GoalForge data anytime, or permanently delete your account and everything in it.</p>
      <div className="gf-data-btns">
        <button onClick={() => { void exportData('json') }} disabled={busy} className="gf-btn gf-btn-soft">
          {isExporting === 'json' ? 'Exporting…' : '↓ Export JSON'}
        </button>
        <button onClick={() => { void exportData('csv') }} disabled={busy} className="gf-btn gf-btn-soft">
          {isExporting === 'csv' ? 'Exporting…' : '↓ Export CSV'}
        </button>
      </div>
      <div className="gf-danger">
        <div>
          <div className="gf-danger-title">Delete account data</div>
          <div className="gf-danger-sub">Removes all goals, tasks, milestones and rewards. Cannot be undone.</div>
        </div>
        <button onClick={() => { void deleteAllData() }} disabled={busy} className="gf-btn gf-btn-danger">
          {isDeleting ? 'Deleting…' : '🗑 Delete'}
        </button>
      </div>
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

  const { settings, isLoading: loading, isError } = useSettingsQuery(userId)

  useEffect(() => { document.title = 'Settings — GoalForge' }, [])

  return (
    <div className="min-h-dvh mesh-bg">

      <main id="main-content" className="gf-main gf-settings">

        {/* Eyebrow */}
        <div className="gf-eyebrow">Manage your preferences</div>

        {/* Appearance — always rendered (theme is a local pref) */}
        <SetSection icon="☀️" title="Appearance" subtitle="Choose how GoalForge looks">
          <div className="gf-row is-top">
            <div>
              <div className="gf-row-title">Theme</div>
              <div className="gf-row-sub">
                {mode === 'system' ? 'Follows your device setting' : `Always ${mode}`}
              </div>
            </div>
            <div className="gf-theme-btns">
              {THEME_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  aria-pressed={mode === opt.value}
                  className={['gf-theme-btn', mode === opt.value && 'is-on'].filter(Boolean).join(' ')}
                >
                  {opt.label}
                </button>
              ))}
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
      </main>
    </div>
  )
}
