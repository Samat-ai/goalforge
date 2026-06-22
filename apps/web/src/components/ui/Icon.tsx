import type { CSSProperties } from 'react'

// One coherent line-icon family (Lucide geometry), ported from the design handoff.
const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V6"/><path d="M8 17v-4"/>',
  spark: '<path d="M12 3l1.9 5.1a2 2 0 0 0 1.1 1.1L20 11l-5 1.9a2 2 0 0 0-1.1 1.1L12 19l-1.9-5a2 2 0 0 0-1.1-1.1L4 11l5-1.9a2 2 0 0 0 1.1-1.1z"/>',
  chat: '<path d="M7.5 19.5A9 9 0 1 0 4 16l-1.4 4.2a.8.8 0 0 0 1 1z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2a1.6 1.6 0 0 1 1.6 1.4l.15 1a8 8 0 0 1 1.9 1.1l.95-.4a1.6 1.6 0 0 1 2 .7l.85 1.47a1.6 1.6 0 0 1-.4 2.05l-.8.62a8 8 0 0 1 0 2.2l.8.62a1.6 1.6 0 0 1 .4 2.05l-.85 1.47a1.6 1.6 0 0 1-2 .7l-.95-.4a8 8 0 0 1-1.9 1.1l-.15 1A1.6 1.6 0 0 1 12 22a1.6 1.6 0 0 1-1.6-1.4l-.15-1a8 8 0 0 1-1.9-1.1l-.95.4a1.6 1.6 0 0 1-2-.7l-.85-1.47a1.6 1.6 0 0 1 .4-2.05l.8-.62a8 8 0 0 1 0-2.2l-.8-.62a1.6 1.6 0 0 1-.4-2.05l.85-1.47a1.6 1.6 0 0 1 2-.7l.95.4a8 8 0 0 1 1.9-1.1l.15-1A1.6 1.6 0 0 1 12 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  bolt: '<path d="M13 2 4.3 12.5a1 1 0 0 0 .8 1.6H11l-1 7.9 8.7-10.6a1 1 0 0 0-.8-1.6H12z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22"/><path d="M14 14.6V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 4.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
  moon: '<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
  book: '<path d="M12 7v13"/><path d="M3.5 18A1.5 1.5 0 0 1 2 16.5V5a2 2 0 0 1 2-2h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a2 2 0 0 1 2 2v11.5a1.5 1.5 0 0 1-1.5 1.5H16a3 3 0 0 0-4 1 3 3 0 0 0-4-1z"/>',
  run: '<path d="M22 12h-3.5l-2.5 7L10 4l-2.5 8H2"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
}

export default function Icon({
  name, size = 18, stroke = 1.75, className, style,
}: {
  name: keyof typeof ICONS | string
  size?: number
  stroke?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  )
}
