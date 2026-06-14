import { Circle, CheckCircle2, GripVertical } from 'lucide-react'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { T } from '../../lib/theme'
import TaskControls from './TaskControls'
import type { Task } from '../../lib/types'

interface TaskItemProps {
  task: Task
  isEditing: boolean
  editingText: string
  setEditingText: (t: string) => void
  onComplete: (id: string) => void
  onStartEdit: (t: Task) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string, orig: string) => void
  regeneratingId: string | null
  onRegenerate: (id: string) => void
  restoringId: string | null
  onRestore: (id: string) => void
  draggable?: boolean
  dateLabel?: string
}

export default function TaskItem({
  task,
  isEditing,
  editingText,
  setEditingText,
  onComplete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  regeneratingId,
  onRegenerate,
  restoringId,
  onRestore,
  draggable = true,
  dateLabel,
}: TaskItemProps) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id, disabled: !draggable || task.is_completed })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'flex-start', gap: 10,
  }
  const pendingCircleColor = draggable ? T.dim : T.amber

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group task-row ${task.is_completed ? 'task-row-complete' : ''}`}
    >
      {/* Drag handle (draggable + pending) or spacer */}
      {draggable && !task.is_completed ? (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          aria-label="Drag to reorder"
          style={{
            flexShrink: 0, background: 'none', border: 'none', padding: 0,
            cursor: 'grab', display: 'flex', alignItems: 'center', marginTop: 2,
            touchAction: 'none', minHeight: 44, minWidth: 44, justifyContent: 'center',
          }}
        >
          <GripVertical size={14} color={T.dim} />
        </button>
      ) : (
        <div style={{ width: 14, flexShrink: 0 }} />
      )}

      {/* Complete toggle */}
      <button
        aria-label={task.is_completed ? 'Task completed' : 'Mark task complete'}
        aria-pressed={task.is_completed}
        disabled={task.is_completed || isEditing}
        onClick={() => !task.is_completed && !isEditing && onComplete(task.id)}
        style={{
          marginTop: 1, flexShrink: 0, background: 'none', border: 'none', padding: 0,
          cursor: !task.is_completed && !isEditing ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center',
        }}
      >
        {task.is_completed
          ? <CheckCircle2 size={16} color={T.emerald} />
          : <Circle size={16} color={pendingCircleColor} />
        }
      </button>

      {/* Description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            autoFocus
            value={editingText}
            onChange={e => setEditingText(e.target.value)}
            onBlur={() => onSaveEdit(task.id, task.description)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onSaveEdit(task.id, task.description)
              if (e.key === 'Escape') onCancelEdit()
            }}
            style={{
              width: '100%', fontSize: 13, background: T.surface,
              border: `1px solid ${T.orange}80`, borderRadius: 5,
              padding: '2px 7px', color: T.text, outline: 'none', fontFamily: T.mono,
            }}
          />
        ) : (
          <>
            <p style={{
              fontSize: 13, color: task.is_completed ? T.dim : T.text,
              textDecoration: task.is_completed ? 'line-through' : 'none',
              lineHeight: 1.5, fontFamily: T.mono, margin: 0,
              display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0,
            }}>
              {task.is_rescue_task && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  color: T.amber, fontFamily: T.mono,
                  border: `1px solid ${T.amber}`,
                  borderRadius: 10, padding: '1px 6px',
                  marginRight: 6, textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  ✦ EASY MODE
                </span>
              )}
              {task.description}
            </p>
            {dateLabel ? (
              <p style={{ fontSize: 10, color: T.amber, fontFamily: T.mono, margin: '1px 0 0', opacity: 0.7 }}>
                {dateLabel}
              </p>
            ) : (
              !task.is_completed && task.tip && (
                <p style={{ fontSize: 11, color: T.orange, fontFamily: T.mono, fontStyle: 'italic', margin: '2px 0 0' }}>
                  "{task.tip}"
                </p>
              )
            )}
          </>
        )}
      </div>

      {/* Action icons — pending tasks only */}
      {!task.is_completed && !isEditing && (
        <TaskControls
          task={task}
          regeneratingId={regeneratingId}
          restoringId={restoringId}
          onStartEdit={onStartEdit}
          onRegenerate={onRegenerate}
          onRestore={onRestore}
        />
      )}
    </div>
  )
}
