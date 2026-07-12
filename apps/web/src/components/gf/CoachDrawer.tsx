// gf/CoachDrawer.tsx — mobile session drawer: slide-over with scrim, Escape-to-close,
// and a Tab focus trap. Transcribed verbatim from
// design_handoff_goalforge/chat-v2/gf-coach-v2.jsx Drawer (lines 396-429). Renders the
// same CoachRail the desktop sidebar uses — NOTES.md "Drawer (mobile)": "Same Rail
// component as desktop (single source of truth)."
import { useEffect, useRef } from 'react'
import { Icon } from './Ui'
import CoachRail, { type CoachRailProps } from './CoachRail'

// querySelectorAll's focusable-element sweep includes <button>/<input>/<textarea>,
// which carry `.disabled`, alongside plain `[href]`/`[tabindex]` elements, which don't.
// `disabled` is typed optional here rather than casting to a single concrete element
// type so the `!el.disabled` check below is valid (and harmlessly `undefined`) for both.
type FocusableEl = HTMLElement & { disabled?: boolean }

export interface CoachDrawerProps {
  open: boolean
  onClose: () => void
  railProps: CoachRailProps
}

export default function CoachDrawer({ open, onClose, railProps }: CoachDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // focus first control + trap Tab inside the panel
    const panel = panelRef.current
    const focusables = (): FocusableEl[] =>
      panel
        ? [...panel.querySelectorAll<FocusableEl>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter(el => !el.disabled && el.offsetParent !== null)
        : []
    const first = focusables()[0]
    first?.focus()
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const f = focusables()
      if (!f.length) return
      const a = f[0]
      const z = f[f.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    panel?.addEventListener('keydown', onTab)
    return () => {
      document.removeEventListener('keydown', onKey)
      panel?.removeEventListener('keydown', onTab)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="gf-co-scrim" onClick={onClose} />
      <div className="gf-co-drawer" ref={panelRef} role="dialog" aria-modal="true" aria-label="Conversations">
        <div className="gf-co-drawer-top">
          <span className="gf-co-drawer-title">Conversations</span>
          <button className="gf-co-drawer-x" aria-label="Close conversations" onClick={onClose}><Icon name="x" size={19} /></button>
        </div>
        <CoachRail {...railProps} />
      </div>
    </>
  )
}
