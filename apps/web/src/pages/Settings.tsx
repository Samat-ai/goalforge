import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/react'
import { toast } from 'sonner'
import api, { setAuthToken } from '../lib/api'
import AppHeader from '../components/AppHeader'
import { T } from '../lib/theme'

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Honolulu',
]

interface UserSettings {
  id: string
  email: string
  star_points: number
  timezone: string
  display_name: string | null
}

export default function Settings() {
  const { user }     = useUser()
  const { getToken } = useAuth()

  const [pts,         setPts]         = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [timezone,    setTimezone]    = useState('UTC')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    let ignore = false

    async function load() {
      try {
        const token = await getToken()
        setAuthToken(token)
        const [settingsRes, profileRes] = await Promise.all([
          api.get<UserSettings>(`/users/${userId}/settings`),
          api.get<{ star_points: number }>(`/users/${userId}/profile`).catch(() => ({ data: { star_points: 0 } })),
        ])
        if (!ignore) {
          setTimezone(settingsRes.data.timezone)
          setDisplayName(settingsRes.data.display_name ?? '')
          setPts(profileRes.data.star_points)
        }
      } catch {
        if (!ignore) setError('Failed to load settings.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [user?.id, getToken])

  async function save() {
    const userId = user?.id
    if (!userId || saving) return
    setSaving(true)
    try {
      await api.patch(`/users/${userId}/settings`, {
        timezone,
        display_name: displayName.trim() || null,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Could not save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.mono }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.dim}; border-radius: 2px; }
        select option { background: ${T.surface}; color: ${T.text}; }
        button:focus-visible, a:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <AppHeader pts={pts} />

      <div style={{ maxWidth: 640, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">

        {/* Page heading */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px]">
            Settings
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>Manage your preferences</p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
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
        {!loading && !error && (
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

            {/* Timezone */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
              <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 10 }}>
                TIMEZONE
              </label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                style={{
                  width: '100%', background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 7, padding: '10px 13px', color: T.text, fontFamily: T.mono,
                  fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center',
                  paddingRight: 36,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.orange }}
                onBlur={e => { e.currentTarget.style.borderColor = T.border }}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 7 }}>
                Used to localise your daily task schedule.
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

          </div>
        )}
      </div>
    </div>
  )
}
