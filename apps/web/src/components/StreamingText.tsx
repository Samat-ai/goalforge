import { useEffect, useMemo, useState } from 'react'

// Reveals text word-by-word (~42ms/word), each word softly fading in
// (ChatGPT-style). `*italic*` segments render as <em>. Instant under reduced motion.
export default function StreamingText({ content, onTick }: { content: string; onTick?: () => void }) {
  const words = useMemo(() => {
    const out: { t: string; italic: boolean }[] = []
    for (const seg of content.split(/(\*[^*]+\*)/g)) {
      if (!seg) continue
      const italic = seg.length > 1 && seg.startsWith('*') && seg.endsWith('*')
      const text = italic ? seg.slice(1, -1) : seg
      for (const t of text.match(/\S+\s*/g) ?? []) out.push({ t, italic })
    }
    return out
  }, [content])

  const [count, setCount] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setCount(words.length); onTick?.(); return }
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setCount(i)
      onTick?.()
      if (i >= words.length) clearInterval(id)
    }, 42)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  return (
    <span className="gf-co-stream">
      {words.slice(0, count).map((w, idx) => w.italic
        ? <em key={idx} className="gf-co-word">{w.t}</em>
        : <span key={idx} className="gf-co-word">{w.t}</span>)}
    </span>
  )
}
