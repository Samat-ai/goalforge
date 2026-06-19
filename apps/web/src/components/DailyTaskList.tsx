import { useState } from 'react'
import Icon from './ui/Icon'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../lib/types'

interface DailyTaskListProps {
  goalId: string
  tasks: Task[]
  overdueTasks?: Task[]
  activeMilestoneId: string | null
  onCompleteTask:   (taskId: string) => void
  onSaveEdit:       (taskId: string, description: string) => void
  onAddTask:        (goalId: string, milestoneId: string | null, description: string) => Promise<void>
  onRegenerateTask: (taskId: string) => Promise<void>
  onReorderTasks:   (goalId: string, tasks: { id: string; position: number }[]) => void
  onRestoreTask?:   (taskId: string) => Promise<void>
}

// ── Unified task row (sortable or overdue) ────────────────────────────────────
function TaskRow({
  task, isEditing, editingText, setEditingText,
  onComplete, onStartEdit, onCancelEdit, onSaveEdit,
  regeneratingId, onRegenerate,
  restoringId, onRestore,
  draggable = true,
  dateLabel,
}: {
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
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id, disabled: !draggable || task.is_completed })

  const isRegen = regeneratingId === task.id
  const isRestoring = restoringId === task.id

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      className={`group gf-task${task.is_completed ? ' is-done' : ''}${dateLabel ? ' is-overdue' : ''}`}
    >
      {/* Drag handle (draggable + pending) or spacer */}
      {draggable && !task.is_completed ? (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          aria-label="Drag to reorder"
          style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'grab', display: 'flex', alignItems: 'center', touchAction: 'none', minHeight: 44, minWidth: 22, justifyContent: 'center' }}
        >
          <Icon name="grip" size={14} style={{ color: 'var(--text-mute)' }} />
        </button>
      ) : (
        <div style={{ width: 10, flexShrink: 0 }} />
      )}

      {/* Complete toggle */}
      <button
        aria-label={task.is_completed ? 'Task completed' : 'Mark task complete'}
        aria-pressed={task.is_completed}
        disabled={task.is_completed || isEditing}
        onClick={() => !task.is_completed && !isEditing && onComplete(task.id)}
        className="gf-check"
        style={{ background: 'none', cursor: !task.is_completed && !isEditing ? 'pointer' : 'default' }}
      >
        <Icon name="check" size={13} stroke={3} />
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
              width: '100%', fontSize: 13, background: 'var(--card-2)',
              border: '1px solid color-mix(in oklab, var(--accent) 50%, transparent)', borderRadius: 6,
              padding: '2px 7px', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)',
            }}
          />
        ) : (
          <>
            <p className="gf-task-label" style={{ margin: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0 }}>
              {task.is_rescue_task && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  color: 'var(--gold)', fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--gold)',
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
              <p style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-mono)', margin: '1px 0 0', opacity: 0.7 }}>
                {dateLabel}
              </p>
            ) : (
              !task.is_completed && task.tip && (
                <p style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontStyle: 'italic', margin: '2px 0 0' }}>
                  &ldquo;{task.tip}&rdquo;
                </p>
              )
            )}
          </>
        )}
      </div>

      {/* Action icons — pending tasks only */}
      {!task.is_completed && !isEditing && (
        <div className="flex items-center gap-0 shrink-0 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          {task.original_description !== null && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => onRestore(task.id)}
              disabled={isRestoring}
              aria-label="Restore original task"
              title="Restore original task"
              className="text-[#7c3aed] hover:text-violet-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
              style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isRestoring ? 0.4 : 1 }}
            >
              <Icon name="undo" size={13} style={isRestoring ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>
          )}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onRegenerate(task.id)}
            disabled={isRegen}
            aria-label="Regenerate task via AI"
            className="text-[#3f3f5c] hover:text-indigo-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="refresh" size={13} style={isRegen ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onStartEdit(task)}
            aria-label="Edit task"
            className="text-[#3f3f5c] hover:text-indigo-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="pencil" size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── DailyTaskList ────────────────────────────────────────────────────────────
export default function DailyTaskList({
  goalId, tasks, overdueTasks = [], activeMilestoneId,
  onCompleteTask, onSaveEdit, onAddTask, onRegenerateTask, onReorderTasks, onRestoreTask,
}: DailyTaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [addTaskText, setAddTaskText] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [showCatchUp, setShowCatchUp] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function startEdit(task: Task) {
    setEditingTaskId(task.id)
    setEditingText(task.description)
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditingText('')
  }

  function handleSaveEdit(taskId: string, original: string) {
    const trimmed = editingText.trim()
    if (!trimmed || trimmed === original) { cancelEdit(); return }
    cancelEdit()
    onSaveEdit(taskId, trimmed)
  }

  async function handleRegenerate(taskId: string) {
    setRegeneratingId(taskId)
    try { await onRegenerateTask(taskId) }
    finally { setRegeneratingId(null) }
  }

  async function handleRestore(taskId: string) {
    if (!onRestoreTask) return
    setRestoringId(taskId)
    try { await onRestoreTask(taskId) }
    finally { setRestoringId(null) }
  }

  async function handleAddTask() {
    const trimmed = addTaskText.trim()
    if (!trimmed || addingTask) return
    setAddingTask(true)
    try {
      await onAddTask(goalId, activeMilestoneId, trimmed)
      setAddTaskText('')
      setShowAddTask(false)
    } finally {
      setAddingTask(false)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...tasks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    onReorderTasks(
      goalId,
      reordered.map((t, i) => ({ id: t.id, position: i })),
    )
  }

  return (
    <div style={{ padding: '0 2px 2px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 7, paddingLeft: 2 }}>
        TODAY&apos;S TASKS
      </div>

      {tasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="gf-tasks">
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isEditing={editingTaskId === task.id}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  onComplete={onCompleteTask}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={handleSaveEdit}
                  regeneratingId={regeneratingId}
                  onRegenerate={handleRegenerate}
                  restoringId={restoringId}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Catch Up — overdue tasks from previous days */}
      {overdueTasks.length > 0 && (
        <div style={{ marginTop: tasks.length > 0 ? 8 : 0 }}>
          <button
            onClick={() => setShowCatchUp(o => !o)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'color-mix(in oklab, var(--gold) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)', borderRadius: 8, padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', letterSpacing: '0.08em' }}
          >
            <Icon name="chevronDown" size={12} style={{ transform: showCatchUp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            CATCH UP — {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} from earlier
          </button>

          {showCatchUp && (
            <div style={{ marginTop: 6 }}>
              <DndContext>
                <SortableContext items={overdueTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="gf-tasks">
                    {overdueTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        draggable={false}
                        dateLabel={`from ${task.assigned_date}`}
                        isEditing={editingTaskId === task.id}
                        editingText={editingText}
                        setEditingText={setEditingText}
                        onComplete={onCompleteTask}
                        onStartEdit={startEdit}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={handleSaveEdit}
                        regeneratingId={regeneratingId}
                        onRegenerate={handleRegenerate}
                        restoringId={restoringId}
                        onRestore={handleRestore}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <p style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-mono)', opacity: 0.6, margin: '4px 0 0', paddingLeft: 10 }}>
                Completing these still earns you +10 pts each.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Task */}
      {showAddTask ? (
        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={addTaskText}
            onChange={e => setAddTaskText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddTask()
              if (e.key === 'Escape') { setShowAddTask(false); setAddTaskText('') }
            }}
            placeholder="Describe your task..."
            disabled={addingTask}
            style={{ flex: 1, fontSize: 13, background: 'var(--card-2)', border: '1px solid color-mix(in oklab, var(--accent) 50%, transparent)', borderRadius: 6, padding: '6px 9px', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)' }}
          />
          <button
            onClick={handleAddTask}
            disabled={addingTask || !addTaskText.trim()}
            className="gf-btn-pill"
            style={{ opacity: addingTask || !addTaskText.trim() ? 0.5 : 1, color: 'var(--accent)', borderColor: 'color-mix(in oklab, var(--accent) 40%, transparent)' }}
          >
            {addingTask ? '···' : 'Add'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTask(true)}
          style={{ marginTop: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: '3px 2px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}
        >
          <Icon name="plus" size={13} /> Add Task
        </button>
      )}
    </div>
  )
}
