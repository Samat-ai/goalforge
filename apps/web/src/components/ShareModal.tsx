import { useRef, useState } from 'react'
import { X, Download, Copy, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import { T } from '../lib/theme'
import { getStage, streak } from '../lib/gamification'
import ProgressShareCard from './ProgressShareCard'
import type { Goal } from '../lib/types'

interface ShareModalProps {
  goal: Goal
  pts: number
  onClose: () => void
}

export default function ShareModal({ goal, pts, onClose }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copying, setCopying]    = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [textCopied, setTextCopied]   = useState(false)

  const stage           = getStage(pts)
  const completedTasks  = goal.daily_tasks.filter(t => t.is_completed).length
  const shareText       = `I just hit ${stage.name} on GoalForge! 🎯 ${completedTasks} tasks completed. goalforge.app`

  async function captureCard(): Promise<HTMLCanvasElement | null> {
    if (!cardRef.current) return null
    return html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    })
  }

  async function handleCopyImage() {
    setCopying(true)
    try {
      const canvas = await captureCard()
      if (!canvas) return
      canvas.toBlob(async (blob) => {
        if (!blob) return
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ])
        } catch {
          // Fallback: download if clipboard write isn't supported
          downloadBlob(blob, buildFilename())
        } finally {
          setCopying(false)
        }
      }, 'image/png')
    } catch {
      setCopying(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const canvas = await captureCard()
      if (!canvas) return
      const url = canvas.toDataURL('image/png')
      const a   = document.createElement('a')
      a.href     = url
      a.download = buildFilename()
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText)
      setTextCopied(true)
      setTimeout(() => setTextCopied(false), 2000)
    } catch {
      // silently ignore clipboard errors
    }
  }

  function buildFilename() {
    const slug = goal.smart_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    return `goalforge-${stage.name.toLowerCase()}-${slug}.png`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share progress card"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: T.card,
        border: `1px solid ${T.borderHi}`,
        borderRadius: 18,
        padding: '24px',
        maxWidth: 620,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.text }}>
              Share Your Progress
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 2 }}>
              Screenshot or save your card to share on social media
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            style={{
              minHeight: 40, minWidth: 40, padding: 8, borderRadius: 8,
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Card preview */}
        <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          <div
            ref={cardRef}
            style={{
              // Constrain to modal width on small screens while keeping aspect
              maxWidth: '100%',
              transformOrigin: 'top center',
            }}
          >
            <ProgressShareCard goal={goal} pts={pts} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <ActionButton
            onClick={handleCopyImage}
            loading={copying}
            icon={<Copy size={14} />}
            label={copying ? 'Copying…' : 'Copy Image'}
            primary
          />
          <ActionButton
            onClick={handleDownload}
            loading={downloading}
            icon={<Download size={14} />}
            label={downloading ? 'Saving…' : 'Download PNG'}
          />
          <ActionButton
            onClick={handleCopyText}
            loading={false}
            icon={<Share2 size={14} />}
            label={textCopied ? '✓ Copied!' : 'Copy Text'}
            success={textCopied}
          />
        </div>

        {/* Text preview */}
        <div style={{
          padding: '10px 13px', borderRadius: 8,
          background: `${T.surface}`, border: `1px solid ${T.border}`,
          fontFamily: T.mono, fontSize: 11, color: T.textDim, lineHeight: 1.6,
        }}>
          {shareText}
        </div>

        {/* Streak callout */}
        {streak(goal.completed_days) > 0 && (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: `${T.amber}08`, border: `1px solid ${T.amber}25`,
            fontFamily: T.mono, fontSize: 10, color: T.amber, letterSpacing: '0.04em',
          }}>
            ✦ {streak(goal.completed_days)}-day streak active — keep going!
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reusable action button ────────────────────────────────────────────────────
interface ActionButtonProps {
  onClick: () => void
  loading: boolean
  icon: React.ReactNode
  label: string
  primary?: boolean
  success?: boolean
}

function ActionButton({ onClick, loading, icon, label, primary, success }: ActionButtonProps) {
  const color = success ? T.emerald : primary ? T.orange : T.indigo

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        minHeight: 44, padding: '0 16px',
        borderRadius: 9, cursor: loading ? 'wait' : 'pointer',
        fontFamily: T.mono, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.05em',
        background: `${color}18`,
        color,
        border: `1px solid ${color}45`,
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        flexShrink: 0,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
