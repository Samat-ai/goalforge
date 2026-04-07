import { Pencil, RefreshCw, Undo2 } from 'lucide-react'
import type { Task } from '../../lib/types'

/**
 * TaskControls — edit/delete controls shown on pending (incomplete) tasks.
 * Renders the restore, regenerate, and edit-pencil icon buttons.
 */
interface TaskControlsProps {
  task: Task
  regeneratingId: string | null
  restoringId: string | null
  onStartEdit: (t: Task) => void
  onRegenerate: (id: string) => void
  onRestore: (id: string) => void
}

export default function TaskControls({
  task,
  regeneratingId,
  restoringId,
  onStartEdit,
  onRegenerate,
  onRestore,
}: TaskControlsProps) {
  const isRegen = regeneratingId === task.id
  const isRestoring = restoringId === task.id

  return (
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
  )
}
