import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { T } from '../lib/theme'
import { queryKeys } from '../lib/queryKeys'
import type { UserSettings, NotificationPrefsUpdatePayload } from '../lib/types'

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = typeof ALL_DAYS[number]

const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function parseDays(raw: string): Day[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((d): d is Day => ALL_DAYS.includes(d as Day))
  } catch {
    // fall through
  }
  return [...ALL_DAYS]
}

interface Props {
  settings: UserSettings
  userId: string
}

export default function NotificationPreferences({ settings, userId }: Props) {
  const qc = useQueryClient()

  const defaultDays = parseDays(settings.reminder_days ?? '[]')
  const [reminderTime, setReminderTime] = useState<string>(settings.reminder_time ?? '09:00')
  const [selectedDays, setSelectedDays] = useState<Set<Day>>(new Set(defaultDays))
  const [emailDigest, setEmailDigest] = useState(settings.email_digest_enabled ?? true)
  const [pushEnabled, setPushEnabled] = useState(settings.push_enabled ?? true)

  const mutation = useMutation({
    mutationFn: async (payload: NotificationPrefsUpdatePayload) => {
      const { data } = await api.patch<UserSettings>(
        `/users/${userId}/notification-preferences`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      toast.success('Notification preferences saved')
      qc.invalidateQueries({ queryKey: queryKeys.settings(userId) })
    },
    onError: () => {
      toast.error('Could not save preferences. Please try again.')
    },
  })

  function toggleDay(day: Day) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }

  function save() {
    if (mutation.isPending) return
    const orderedDays = ALL_DAYS.filter(d => selectedDays.has(d))
    mutation.mutate({
      reminder_time: reminderTime || null,
      reminder_days: JSON.stringify(orderedDays),
      email_digest_enabled: emailDigest,
      push_enabled: pushEnabled,
    })
  }

  const saving = mutation.isPending

  const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 36,
    borderRadius: 8,
    fontFamily: T.mono,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    border: '1px solid',
    transition: 'background 0.15s, color 0.15s',
    userSelect: 'none',
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
      <label style={{ display: 'block', fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 16 }}>
        NOTIFICATION PREFERENCES
      </label>

      {/* Reminder time */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: '0.08em', fontFamily: T.mono, marginBottom: 8 }}>
          REMINDER TIME
        </div>
        <input
          type="time"
          value={reminderTime}
          onChange={e => setReminderTime(e.target.value)}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            padding: '9px 13px',
            color: T.text,
            fontFamily: T.mono,
            fontSize: 13,
            outline: 'none',
            colorScheme: 'dark',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = T.orange }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border }}
        />
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 6 }}>
          Time in your local timezone when reminders fire.
        </div>
      </div>

      {/* Day chips */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: '0.08em', fontFamily: T.mono, marginBottom: 8 }}>
          ACTIVE DAYS
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_DAYS.map(day => {
            const active = selectedDays.has(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                style={{
                  ...chipBase,
                  background: active ? `${T.orange}22` : T.surface,
                  color: active ? T.orange : T.muted,
                  borderColor: active ? T.orange : T.border,
                }}
                aria-pressed={active}
                aria-label={`Toggle ${DAY_LABELS[day]}`}
              >
                {DAY_LABELS[day]}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 6 }}>
          Days of the week on which reminders are sent.
        </div>
      </div>

      {/* Toggle switches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <ToggleRow
          label="Email digest"
          description="Receive a daily summary of pending tasks by email."
          checked={emailDigest}
          onChange={setEmailDigest}
        />
        <ToggleRow
          label="Push notifications"
          description="Receive browser push reminders when enabled."
          checked={pushEnabled}
          onChange={setPushEnabled}
        />
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        style={{
          cursor: saving ? 'default' : 'pointer',
          padding: '10px 24px',
          borderRadius: 8,
          minHeight: 44,
          fontFamily: T.mono,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.04em',
          background: T.orange,
          color: '#fff',
          border: 'none',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? '···' : 'Save preferences'}
      </button>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: T.text, fontFamily: T.mono }}>{label}</div>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{description}</div>
      </div>
      {/* Toggle switch */}
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? T.orange : T.border,
          position: 'relative',
          transition: 'background 0.2s',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </label>
  )
}
