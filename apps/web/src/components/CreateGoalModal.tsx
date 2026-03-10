import { useState } from 'react'
import { useUser } from '@clerk/react'
import { Sparkles, X } from 'lucide-react'
import api from '../lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateGoalModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useUser()
  const [rawInput, setRawInput] = useState('')
  const [forging, setForging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleForge() {
    if (rawInput.trim().length < 10) {
      setError('Please describe your goal in at least 10 characters.')
      return
    }
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) {
      setError('Could not read your email address. Please refresh and try again.')
      return
    }
    setForging(true)
    setError(null)
    try {
      await api.post(
        `/users/${user!.id}/goals?email=${encodeURIComponent(email)}`,
        { raw_input: rawInput.trim() }
      )
      setRawInput('')
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setForging(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !forging) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-indigo-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-6 p-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-violet-400" />
              Forge a New Goal
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Describe what you want to achieve. The AI will turn it into a structured SMART goal.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={forging}
            className="text-slate-500 hover:text-white transition-colors disabled:opacity-40 mt-0.5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          disabled={forging}
          rows={5}
          placeholder="e.g. I want to finish LeetCode 75 by May so I can pass technical interviews..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/60 disabled:opacity-50 transition"
        />

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 -mt-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={forging}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleForge}
            disabled={forging || rawInput.trim().length < 10}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
          >
            {forging ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                AI is forging your plan...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Forge Goal
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
