import { useState } from 'react'
import { Circle, CheckCircle2, GripVertical, Pencil, Plus, RefreshCw, ChevronDown } from 'lucide-react'
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
import { T } from '../lib/theme'
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
}

// ── Unified task row (sortable or overdue) ────────────────────────────────────
function TaskRow({
  task, isEditing, editingText, setEditingText,
  onComplete, onStartEdit, onCancelEdit, onSaveEdit,
  regeneratingId, onRegenerate,
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
  const pendingCircleColor = draggable ? T.dim : T.amber

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="group">
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
            }}>
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
        <div className="flex items-center gap-0 shrink-0 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
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
  onCompleteTask, onSaveEdit, onAddTask, onRegenerateTask, onReorderTasks,
}: DailyTaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
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
    <div style={{ margin: '0 18px 14px', padding: '13px 15px', background: T.surface, borderRadius: 9, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>
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
              background: `${T.amber}08`, border: `1px solid ${T.amber}25`, borderRadius: 7,
              padding: '7px 10px', fontFamily: T.mono, fontSize: 10, color: T.amber,
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
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <p style={{ fontSize: 10, color: T.amber, fontFamily: T.mono, opacity: 0.6, margin: '2px 0 0', paddingLeft: 24 }}>
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
              flex: 1, fontSize: 13, background: T.surface,
              border: `1px solid ${T.orange}80`, borderRadius: 5,
              padding: '5px 9px', color: T.text, outline: 'none', fontFamily: T.mono,
            }}
          />
          <button
            onClick={handleAddTask}
            disabled={addingTask || !addTaskText.trim()}
            style={{
              cursor: addingTask || !addTaskText.trim() ? 'default' : 'pointer',
              padding: '4px 12px', borderRadius: 6, fontFamily: T.mono, fontSize: 11,
              background: `${T.orange}20`, color: T.orange, border: `1px solid ${T.orange}50`,
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
            fontFamily: T.mono, fontSize: 11, color: T.muted,
          }}
        >
          <Plus size={13} /> Add Task
        </button>
      )}
    </div>
  )
}
