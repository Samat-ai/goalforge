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

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const isRegen = regeneratingId === task.id
  const isRestoring = restoringId === task.id
  const pendingCircleColor = draggable ? 'var(--text-mute)' : 'var(--gold)'

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      {...attributes}
      className={`gf-tr group task-row ${task.is_completed ? 'task-row-complete' : ''}`}
    >
      {/* Drag handle (draggable + pending) or spacer */}
      {draggable && !task.is_completed ? (
        <button ref={setActivatorNodeRef} {...listeners} aria-label="Drag to reorder" className="gf-tr-drag">
          <GripVertical size={14} color="var(--text-mute)" />
        </button>
      ) : (
        <div className="gf-tr-spacer" />
      )}

      {/* Complete toggle */}
      <button
        aria-label={task.is_completed ? 'Task completed' : 'Mark task complete'}
        aria-pressed={task.is_completed}
        disabled={task.is_completed || isEditing}
        onClick={() => !task.is_completed && !isEditing && onComplete(task.id)}
        className={`gf-tr-check${!task.is_completed && !isEditing ? ' can-complete' : ''}`}
      >
        {task.is_completed
          ? <CheckCircle2 size={16} color="var(--emerald)" />
          : <Circle size={16} color={pendingCircleColor} />
        }
      </button>

      {/* Description */}
      <div className="gf-tr-body">
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
            className="gf-tr-edit"
          />
        ) : (
          <>
            <p className={`gf-tr-text${task.is_completed ? ' is-done' : ''}`}>
              {task.is_rescue_task && <span className="gf-tr-rescue">✦ EASY MODE</span>}
              {task.description}
            </p>
            {dateLabel ? (
              <p className="gf-tr-date">{dateLabel}</p>
            ) : (
              !task.is_completed && task.tip && (
                <p className="gf-tr-tip">&quot;{task.tip}&quot;</p>
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
              className="gf-tr-icon text-[#7c3aed] hover:text-violet-400 transition-colors"
              style={isRestoring ? { opacity: 0.4 } : undefined}
            >
              <Undo2 size={13} style={isRestoring ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>
          )}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onRegenerate(task.id)}
            disabled={isRegen}
            aria-label="Regenerate task via AI"
            className="gf-tr-icon text-[#3f3f5c] hover:text-indigo-400 transition-colors"
          >
            <RefreshCw size={13} style={isRegen ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => onStartEdit(task)}
            aria-label="Edit task"
            className="gf-tr-icon text-[#3f3f5c] hover:text-indigo-400 transition-colors"
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

  const hasTasks = tasks.length > 0 || overdueTasks.length > 0

  return (
    <div className="gf-tl">
      <div className="gf-tl-cap">TODAY&apos;S TASKS</div>

      {tasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="gf-tl-rows">
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
        <div style={tasks.length > 0 ? { marginTop: 10 } : undefined}>
          <button onClick={() => setShowCatchUp(o => !o)} className="gf-catchup-btn">
            <ChevronDown size={12} className={`gf-catchup-chev${showCatchUp ? ' is-open' : ''}`} />
            CATCH UP — {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} from earlier
          </button>

          {showCatchUp && (
            <div className="gf-tl-rows" style={{ marginTop: 8 }}>
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
              <p className="gf-catchup-pts">Completing these still earns you +10 pts each.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Task */}
      {showAddTask ? (
        <div className="gf-addtask-row" style={hasTasks ? { marginTop: 8 } : undefined}>
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
            className="gf-addtask-in"
          />
          <button
            onClick={handleAddTask}
            disabled={addingTask || !addTaskText.trim()}
            className="gf-addtask-btn"
          >
            {addingTask ? '···' : 'Add'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTask(true)}
          className="gf-addtask-trigger"
          style={hasTasks ? { marginTop: 8 } : undefined}
        >
          <Plus size={13} /> Add Task
        </button>
      )}
    </div>
  )
}
