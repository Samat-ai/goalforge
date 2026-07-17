// components/gf/SollySuggestion.tsx — Solly's proactive mode-suggestion banner.
// Dashboard renders it when lib/suggestions.pickSuggestion finds the moment;
// all copy/constants live in lib/suggestions.ts (component-only exports rule).
import { Icon, Reveal } from './Ui'
import type { Suggestion } from '../../lib/suggestions'

const SOLLY_ART: Record<Suggestion['type'], string> = {
  energy: '/solly/solly-tired.svg',
  focus: '/solly/solly-sunglasses.svg',
}

export default function SollySuggestion({ suggestion, onAct, onDismiss }: {
  suggestion: Suggestion
  onAct: () => void
  onDismiss: () => void
}) {
  return (
    <Reveal className="gf-nudge is-indigo gf-suggest" delay={50}>
      <img src={SOLLY_ART[suggestion.type]} className="gf-suggest-solly" alt="" width={44} height={44} />
      <div className="gf-nudge-body">
        <div className="gf-nudge-kicker">Solly suggests</div>
        <div className="gf-nudge-title">{suggestion.title}</div>
        <div className="gf-nudge-sub">{suggestion.body}</div>
      </div>
      <button className="gf-btn-ghost-accent" onClick={onAct}>{suggestion.cta}</button>
      <button className="gf-nudge-x" aria-label="Dismiss suggestion" onClick={onDismiss}>
        <Icon name="x" size={15} />
      </button>
    </Reveal>
  )
}
