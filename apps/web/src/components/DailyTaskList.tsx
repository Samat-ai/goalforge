import { useState } from 'react'
import { Circle, CheckCircle2, GripVertical, Pencil, Plus, RefreshCw, ChevronDown, Undo2 } from 'lucide-react'
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'flex-start', gap: 10,
  }
  const isRegen = regeneratingId === task.id
  const isRestoring = restoringId === task.id
  const pendingCircleColor = draggable ? 'var(--text-mute)' : 'var(--gold)'

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
          <GripVertical size={14} color="var(--text-mute)" />
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
          ? <CheckCircle2 size={16} color="var(--emerald)" />
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
              width: '100%', fontSize: 13, background: 'var(--card-hi)',
              border: '1px solid color-mix(in oklab, var(--accent) 50%, transparent)', borderRadius: 5,
              padding: '2px 7px', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)',
            }}
          />
        ) : (
          <>
            <p style={{
              fontSize: 13, color: task.is_completed ? 'var(--text-mute)' : 'var(--text)',
              textDecoration: task.is_completed ? 'line-through' : 'none',
              lineHeight: 1.5, fontFamily: 'var(--font-mono)', margin: 0,
              display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0,
            }}>
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
                  "{task.tip}"
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
              <Undo2 size={13} style={isRestoring ? { animation: 'spin 1s linear infinite' } : undefined} />
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
            <RefreshCw size={13} style={isRegen ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onStartEdit(task)}
            aria-label="Edit task"
            className="text-[#3f3f5c] hover:text-indigo-400 transition-colors rounded bg-transparent border-0 cursor-pointer"
            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Pencil size={13} />
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
    <div style={{ margin: '0 18px 14px', padding: '13px 15px', background: 'var(--card-hi)', borderRadius: 9, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 9 }}>
        TODAY'S TASKS
      </div>

      {tasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        <div style={{ marginTop: tasks.length > 0 ? 10 : 0 }}>
          <button
            onClick={() => setShowCatchUp(o => !o)}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              background: 'color-mix(in oklab, var(--gold) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)', borderRadius: 7,
              padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)',
              letterSpacing: '0.08em',
            }}
          >
            <ChevronDown
              size={12}
              style={{ transform: showCatchUp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
            />
            CATCH UP — {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} from earlier
          </button>

          {showCatchUp && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DndContext>
                <SortableContext items={overdueTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
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
                </SortableContext>
              </DndContext>
              <p style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-mono)', opacity: 0.6, margin: '2px 0 0', paddingLeft: 24 }}>
                Completing these still earns you +10 pts each.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Task */}
      {showAddTask ? (
        <div style={{ marginTop: tasks.length > 0 || overdueTasks.length > 0 ? 8 : 0, display: 'flex', gap: 8, alignItems: 'center' }}>
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
            style={{
              flex: 1, fontSize: 13, background: 'var(--card-hi)',
              border: '1px solid color-mix(in oklab, var(--accent) 50%, transparent)', borderRadius: 5,
              padding: '5px 9px', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={handleAddTask}
            disabled={addingTask || !addTaskText.trim()}
            style={{
              cursor: addingTask || !addTaskText.trim() ? 'default' : 'pointer',
              padding: '4px 12px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11,
              background: 'color-mix(in oklab, var(--accent) 18%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in oklab, var(--accent) 45%, transparent)',
              opacity: addingTask || !addTaskText.trim() ? 0.5 : 1,
            }}
          >
            {addingTask ? '···' : 'Add'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTask(true)}
          style={{
            marginTop: tasks.length > 0 || overdueTasks.length > 0 ? 8 : 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', padding: '3px 0',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)',
          }}
        >
          <Plus size={13} /> Add Task
        </button>
      )}
    </div>
  )
}
