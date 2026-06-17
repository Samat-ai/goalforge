import { useLayoutEffect, useRef, useState } from 'react'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

interface SegmentedProps {
  options: string[]
  value: string
  onChange: (v: string) => void
  getLabel?: (o: string) => string
}

export default function Segmented({ options, value, onChange, getLabel }: SegmentedProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-seg="${value}"]`)
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [value, options])

  return (
    <div ref={wrap} className="gf-seg" role="tablist">
      <div
        className="gf-seg-pill"
        style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.ready ? 1 : 0 }}
      />
      {options.map(o => (
        <button
          key={o}
          data-seg={o}
          role="tab"
          aria-selected={value === o}
          className={cx('gf-seg-btn', value === o && 'is-active')}
          onClick={() => onChange(o)}
        >
          {getLabel ? getLabel(o) : o}
        </button>
      ))}
    </div>
  )
}
