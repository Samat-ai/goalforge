import { useState } from 'react'
import { NotebookPen, Pencil, Trash2, X, Check } from 'lucide-react'
import { T } from '../lib/theme'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../hooks/useNotes'
import type { GoalNote, Mood } from '../lib/types'

// ── Mood configuration ───────────────────────────────────────────────────────

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '🚀', label: 'Great' },
  { value: 'good',  emoji: '😊', label: 'Good' },
  { value: 'okay',  emoji: '😐', label: 'Okay' },
  { value: 'rough', emoji: '😔', label: 'Rough' },
  { value: 'stuck', emoji: '🔒', label: 'Stuck' },
]

function moodEmoji(mood: Mood | null): string {
  return MOODS.find(m => m.value === mood)?.emoji ?? '📝'
}

// ── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 30)  return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

// ── Note item ────────────────────────────────────────────────────────────────

interface NoteItemProps {
  note: GoalNote
  goalId: string
}

function NoteItem({ note, goalId }: NoteItemProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [editMood, setEditMood] = useState<Mood | null>(note.mood)

  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  async function handleSave() {
    if (!editContent.trim()) return
    await updateNote.mutateAsync({
      goalId,
      noteId: note.id,
      content: editContent.trim(),
      mood: editMood,
    })
    setEditing(false)
  }

  function handleCancel() {
    setEditContent(note.content)
    setEditMood(note.mood)
    setEditing(false)
  }

  async function handleDelete() {
    await deleteNote.mutateAsync({ goalId, noteId: note.id })
  }

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {editing ? (
        <>
          {/* Mood selector in edit mode */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {MOODS.map(m => (
              <button
                key={m.value}
                onClick={() => setEditMood(editMood === m.value ? null : m.value)}
                title={m.label}
                style={{
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  border: `1px solid ${editMood === m.value ? T.indigo : T.border}`,
                  background: editMood === m.value ? `${T.indigo}20` : 'transparent',
                  color: T.text,
                }}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>

          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            maxLength={2000}
            rows={3}
            style={{
              width: '100%',
              background: T.card,
              border: `1px solid ${T.borderHi}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 13,
              padding: '8px 10px',
              resize: 'vertical',
              fontFamily: T.serif,
              lineHeight: 1.55,
              boxSizing: 'border-box',
              outline: 'none',
            }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                cursor: 'pointer', padding: '5px 12px', borderRadius: 7,
                fontSize: 12, background: 'transparent', color: T.muted,
                border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <X size={12} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateNote.isPending || !editContent.trim()}
              style={{
                cursor: updateNote.isPending || !editContent.trim() ? 'default' : 'pointer',
                padding: '5px 12px', borderRadius: 7,
                fontSize: 12, background: `${T.indigo}20`, color: T.indigo,
                border: `1px solid ${T.indigo}60`,
                opacity: updateNote.isPending || !editContent.trim() ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Check size={12} /> Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{moodEmoji(note.mood)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6,
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
              }}>
                {note.content}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setEditing(true)}
                title="Edit note"
                style={{
                  cursor: 'pointer', padding: 4, borderRadius: 5,
                  background: 'transparent', border: 'none', color: T.muted,
                  minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteNote.isPending}
                title="Delete note"
                style={{
                  cursor: deleteNote.isPending ? 'default' : 'pointer', padding: 4, borderRadius: 5,
                  background: 'transparent', border: 'none', color: T.rose,
                  opacity: deleteNote.isPending ? 0.5 : 1,
                  minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginLeft: 24 }}>
            {relativeTime(note.created_at)}
          </div>
        </>
      )}
    </div>
  )
}

// ── Note composer ────────────────────────────────────────────────────────────

interface NoteComposerProps {
  goalId: string
}

function NoteComposer({ goalId }: NoteComposerProps) {
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const createNote = useCreateNote()

  async function handleSubmit() {
    if (!content.trim()) return
    await createNote.mutateAsync({ goalId, content: content.trim(), mood })
    setContent('')
    setMood(null)
  }

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.borderHi}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      {/* Mood picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {MOODS.map(m => (
          <button
            key={m.value}
            onClick={() => setMood(mood === m.value ? null : m.value)}
            title={m.label}
            style={{
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 12,
              border: `1px solid ${mood === m.value ? T.indigo : T.border}`,
              background: mood === m.value ? `${T.indigo}20` : 'transparent',
              color: T.text,
              fontFamily: T.mono,
            }}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="How's it going? Jot a quick note…"
        maxLength={2000}
        rows={3}
        style={{
          width: '100%',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          color: T.text,
          fontSize: 13,
          padding: '8px 10px',
          resize: 'vertical',
          fontFamily: T.serif,
          lineHeight: 1.55,
          boxSizing: 'border-box',
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = T.indigo + '80' }}
        onBlur={e => { e.currentTarget.style.borderColor = T.border }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>
          {content.length}/2000
        </span>
        <button
          onClick={handleSubmit}
          disabled={createNote.isPending || !content.trim()}
          style={{
            cursor: createNote.isPending || !content.trim() ? 'default' : 'pointer',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: T.mono,
            fontWeight: 600,
            background: content.trim() ? `${T.indigo}25` : 'transparent',
            color: content.trim() ? T.indigo : T.muted,
            border: `1px solid ${content.trim() ? T.indigo + '60' : T.border}`,
            opacity: createNote.isPending ? 0.5 : 1,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {createNote.isPending ? 'Adding…' : '+ Add Note'}
        </button>
      </div>
    </div>
  )
}

// ── GoalNotes panel ──────────────────────────────────────────────────────────

interface GoalNotesProps {
  goalId: string
}

export default function GoalNotes({ goalId }: GoalNotesProps) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useNotes(goalId)

  const notes = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ margin: '0 18px 14px' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: T.mono,
          background: open ? `${T.indigo}15` : 'transparent',
          color: open ? T.indigo : T.muted,
          border: `1px solid ${open ? T.indigo + '50' : T.border}`,
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          minHeight: 36,
        }}
      >
        <NotebookPen size={13} />
        Journal
        {total > 0 && (
          <span style={{
            background: open ? `${T.indigo}30` : `${T.dim}50`,
            color: open ? T.indigo : T.muted,
            borderRadius: 10,
            fontSize: 10,
            padding: '1px 6px',
            fontWeight: 600,
          }}>
            {total}
          </span>
        )}
        <span style={{
          fontSize: 10,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          marginLeft: 2,
        }}>▾</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{ marginTop: 10 }}>
          <NoteComposer goalId={goalId} />

          {isLoading ? (
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, padding: '8px 0' }}>
              Loading notes…
            </div>
          ) : notes.length === 0 ? (
            <div style={{
              fontSize: 12, color: T.muted, fontFamily: T.mono,
              padding: '14px 0', textAlign: 'center',
            }}>
              No notes yet. How's it going?
            </div>
          ) : (
            notes.map(note => (
              <NoteItem key={note.id} note={note} goalId={goalId} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
