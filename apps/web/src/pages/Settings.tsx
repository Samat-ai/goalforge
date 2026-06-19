import { useState, useEffect } from 'react'
import { useUser } from '@clerk/react'
import { toast } from 'sonner'
import { T } from '../lib/theme'
import api from '../lib/api'
import {
  useAccountabilityMutations,
  useAccountabilityQuery,
  useEnablePushMutation,
  usePushSubscriptionsQuery,
  useSettingsQuery,
  useSaveSettingsMutation,
} from '../hooks'
import type { UserSettings } from '../lib/types'


function SettingsForm({ settings, userId }: { settings: UserSettings; userId: string }) {
  const { save: saveSettings, isSaving: saving } = useSaveSettingsMutation(userId)
  const { subscriptions } = usePushSubscriptionsQuery(userId)
  const { enablePush, isEnabling } = useEnablePushMutation(userId)
  const { data: accountability } = useAccountabilityQuery(userId)
  const {
    sendInvite,
    acceptInvite,
    declineInvite,
    isSendingInvite,
    isAcceptingInvite,
    isDecliningInvite,
  } = useAccountabilityMutations(userId)

  const [displayName, setDisplayName] = useState(settings.display_name ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(settings.reminder_enabled)
  const [reminderHour, setReminderHour] = useState(settings.reminder_hour)
  const [inviteEmail, setInviteEmail] = useState('')

  function save() {
    if (saving) return
    saveSettings({
      display_name: displayName.trim() || null,
      reminder_enabled: reminderEnabled,
      reminder_hour: reminderHour,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Display name */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          DISPLAY NAME
        </label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={60}
          style={{
            width: '100%', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 7, padding: '10px 13px', color: T.text, fontFamily: T.mono,
            fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = T.orange }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border }}
        />
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 7 }}>
          Shown in place of your Clerk username if set.
        </div>
      </div>

      {/* Timezone (auto-detected) */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          TIMEZONE
        </label>
        <div style={{
          width: '100%', background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 7, padding: '10px 13px', color: T.textDim, fontFamily: T.mono,
          fontSize: 13,
        }}>
          {settings.timezone}
        </div>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 7 }}>
          Automatically detected from your browser. Updates when you travel.
        </div>
      </div>

      {/* Reminders */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          DAILY REMINDER
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', minHeight: 44 }}>
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={e => setReminderEnabled(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: T.orange }}
          />
          <span style={{ fontSize: 13, color: T.text }}>Email me a daily digest of pending tasks</span>
        </label>

        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          REMINDER HOUR (LOCAL TIME)
        </label>
        <select
          value={reminderHour}
          onChange={e => setReminderHour(Number(e.target.value))}
          disabled={!reminderEnabled}
          style={{
            width: '100%', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 7, padding: '10px 13px', color: T.text, fontFamily: T.mono,
            fontSize: 13, outline: 'none', cursor: reminderEnabled ? 'pointer' : 'default', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center',
            paddingRight: 36, opacity: reminderEnabled ? 1 : 0.6,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = T.orange }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border }}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}:00</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 7 }}>
          Reminders are sent when your local timezone reaches this hour.
        </div>
      </div>

      {/* Save button */}
      <div>
        <button
          onClick={save}
          disabled={saving}
          style={{
            cursor: saving ? 'default' : 'pointer',
            padding: '10px 24px', borderRadius: 8, minHeight: 44,
            fontFamily: T.mono, fontSize: 12, fontWeight: 500,
            letterSpacing: '0.04em', background: T.orange,
            color: '#fff', border: 'none', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '···' : 'Save settings'}
        </button>
      </div>

      {/* Push notifications */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          WEB PUSH REMINDERS
        </label>
        <button
          onClick={() => enablePush()}
          disabled={isEnabling}
          style={{
            cursor: isEnabling ? 'default' : 'pointer',
            padding: '10px 18px', borderRadius: 8, minHeight: 44, minWidth: 44,
            fontFamily: T.mono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', background: `${T.indigo}18`,
            color: T.indigo, border: `1px solid ${T.indigo}45`, opacity: isEnabling ? 0.6 : 1,
          }}
        >
          {isEnabling ? 'Enabling…' : 'Enable Browser Notifications'}
        </button>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 8 }}>
          Active browser subscriptions: {subscriptions.filter(s => s.is_active).length}
        </div>
      </div>

      {/* Accountability partners */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
          ACCOUNTABILITY PARTNERS
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Invite by email"
            style={{
              flex: 1,
              minHeight: 44,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: T.text,
              fontFamily: T.mono,
              fontSize: 12,
            }}
          />
          <button
            onClick={() => {
              const normalized = inviteEmail.trim()
              if (!normalized || isSendingInvite) return
              sendInvite(normalized)
              setInviteEmail('')
            }}
            disabled={isSendingInvite}
            style={{
              minHeight: 44,
              minWidth: 44,
              border: `1px solid ${T.indigo}45`,
              borderRadius: 8,
              padding: '0 14px',
              background: `${T.indigo}18`,
              color: T.indigo,
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.05em',
              cursor: isSendingInvite ? 'default' : 'pointer',
              opacity: isSendingInvite ? 0.6 : 1,
            }}
          >
            {isSendingInvite ? 'Sending…' : 'Send Invite'}
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.08em', fontFamily: T.mono, marginBottom: 8 }}>
            INCOMING INVITES
          </div>
          {(accountability?.incoming.length ?? 0) === 0 ? (
            <div style={{ fontSize: 12, color: T.dim }}>No incoming invites.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accountability?.incoming.map(invite => (
                <div key={invite.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  background: T.surface,
                  padding: '9px 10px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.text }}>
                      {invite.inviter_display_name ?? invite.inviter_email ?? invite.inviter_user_id}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>
                      {invite.inviter_email ? `${invite.inviter_email} · Pending invite` : 'Pending invite'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      disabled={isAcceptingInvite || isDecliningInvite}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        borderRadius: 8,
                        border: `1px solid ${T.emerald}`,
                        background: `${T.emerald}15`,
                        color: T.emerald,
                        fontFamily: T.mono,
                        fontSize: 11,
                        padding: '0 10px',
                        cursor: isAcceptingInvite || isDecliningInvite ? 'default' : 'pointer',
                        opacity: isAcceptingInvite || isDecliningInvite ? 0.6 : 1,
                      }}
                    >
                      {isAcceptingInvite ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => declineInvite(invite.id)}
                      disabled={isAcceptingInvite || isDecliningInvite}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        borderRadius: 8,
                        border: `1px solid ${T.rose}`,
                        background: `${T.rose}15`,
                        color: T.rose,
                        fontFamily: T.mono,
                        fontSize: 11,
                        padding: '0 10px',
                        cursor: isAcceptingInvite || isDecliningInvite ? 'default' : 'pointer',
                        opacity: isAcceptingInvite || isDecliningInvite ? 0.6 : 1,
                      }}
                    >
                      {isDecliningInvite ? 'Declining…' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.08em', fontFamily: T.mono, marginBottom: 8 }}>
            ACTIVE PARTNERS
          </div>
          {(accountability?.partners.length ?? 0) === 0 ? (
            <div style={{ fontSize: 12, color: T.dim }}>No partners yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {accountability?.partners.map(partner => (
                <div key={partner.id} style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  background: T.surface,
                  padding: '9px 10px',
                }}>
                  <div style={{ fontSize: 13, color: T.text }}>
                    {partner.partner_display_name ?? partner.partner_email}
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>{partner.partner_email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: T.dim, fontFamily: T.mono }}>
          Outgoing pending invites: {accountability?.outgoing.length ?? 0}
        </div>
      </div>

      {/* Data controls */}
      <DataControls userId={userId} />

    </div>
  )
}

function DataControls({ userId }: { userId: string }) {
  const [isExporting, setIsExporting] = useState<null | 'json' | 'csv'>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const busy = !!isExporting || isDeleting

  async function exportData(format: 'json' | 'csv') {
    if (busy) return
    setIsExporting(format)
    try {
      const response = await api.get(`/users/${userId}/export`, {
        params: { format },
        responseType: 'blob',
      })
      const ext = format === 'json' ? 'json' : 'csv'
      const datePart = new Intl.DateTimeFormat('en-CA').format(new Date())
      const blob = new Blob([response.data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `goalforge-export-${datePart}.${ext}`
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

  const btnBase = {
    minHeight: 44, minWidth: 44, padding: '10px 16px', borderRadius: 8,
    fontFamily: T.mono, fontSize: 12,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
        DATA CONTROLS
      </div>
      <p style={{ fontSize: 12, color: T.dim, marginBottom: 14 }}>
        Export your full GoalForge data or permanently delete your account data.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => { void exportData('json') }}
          disabled={busy}
          style={{ ...btnBase, background: T.surface, color: T.text, border: `1px solid ${T.border}` }}
        >
          {isExporting === 'json' ? 'Exporting\u2026' : 'Export JSON'}
        </button>
        <button
          onClick={() => { void exportData('csv') }}
          disabled={busy}
          style={{ ...btnBase, background: T.surface, color: T.text, border: `1px solid ${T.border}` }}
        >
          {isExporting === 'csv' ? 'Exporting\u2026' : 'Export CSV'}
        </button>
        <button
          onClick={() => { void deleteAllData() }}
          disabled={busy}
          style={{ ...btnBase, background: `${T.rose}15`, color: T.rose, border: `1px solid ${T.rose}` }}
        >
          {isDeleting ? 'Deleting\u2026' : 'Delete Account Data'}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useUser()
  const userId = user?.id

  const { settings, isLoading: loading, isError } = useSettingsQuery(userId)
  useEffect(() => { document.title = 'Settings — GoalForge' }, [])

  const error = isError ? 'Failed to load settings.' : null

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
        select option { background: ${T.surface}; color: ${T.text}; }
        button:focus-visible, a:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <main id="main-content" style={{ maxWidth: 640, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px]">
            Settings
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>Manage your preferences</p>
        </div>

        {/* Loading */}
        {loading && (
          <div role="status" aria-label="Loading settings" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `2px solid ${T.dim}`, borderTop: `2px solid ${T.orange}`,
              animation: 'spin 0.75s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            padding: '20px 22px', background: `${T.rose}10`, border: `1px solid ${T.rose}30`,
            borderRadius: 12, color: T.rose, fontSize: 13, fontFamily: T.mono,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        {!loading && !error && settings && userId && (
          <SettingsForm settings={settings} userId={userId} />
        )}
      </main>
    </div>
  )
}
