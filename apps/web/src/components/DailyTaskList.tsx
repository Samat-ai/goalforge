import { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { T } from '../lib/theme'
import TaskItem from './daily-task-list/TaskItem'
import TaskEmptyState from './daily-task-list/TaskEmptyState'
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
    <div style={{ margin: '0 18px 14px', padding: '13px 15px', background: T.surface, borderRadius: 9, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: '0.1em', fontFamily: T.mono, marginBottom: 9 }}>
        TODAY'S TASKS
      </div>

      {tasks.length === 0 && overdueTasks.length === 0 && <TaskEmptyState />}

      {tasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(task => (
                <TaskItem
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
                    <TaskItem
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
