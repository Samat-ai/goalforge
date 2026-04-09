import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { T } from '../lib/theme'
import type { Goal } from '../lib/types'

// Stage emoji by goal_type (best-effort mapping; falls back to a star)
const STAGE_EMOJI: Record<string, string> = {
  fitness: '💪',
  health: '🏃',
  career: '💼',
  learning: '📚',
  finance: '💰',
  personal: '✨',
  travel: '✈️',
  creative: '🎨',
  social: '🤝',
}

function goalEmoji(goalType: string): string {
  return STAGE_EMOJI[goalType.toLowerCase()] ?? '✦'
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface GoalSearchProps {
  userId: string
  onSelect?: (goal: Goal) => void
}

export default function GoalSearch({ userId, onSelect }: GoalSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQ = useDebounce(inputValue.trim(), 300)

  const { data: results = [] } = useQuery<Goal[]>({
    queryKey: ['goals', 'search', userId, debouncedQ],
    queryFn: async () => {
      const { data } = await api.get<Goal[]>(
        `/users/${userId}/goals/search`,
        { params: { q: debouncedQ } },
      )
      return data
    },
    enabled: debouncedQ.length >= 2 && !!userId,
    staleTime: 30_000,
  })

  const visible = debouncedQ.length >= 2 && isOpen
  const shown = results.slice(0, 5)
  const hasMore = results.length > 5

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((goal: Goal) => {
    onSelect?.(goal)
    setInputValue('')
    setIsOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
  }, [onSelect])

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && shown[activeIndex]) {
        handleSelect(shown[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setInputValue('')
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: isOpen && visible ? '8px 8px 0 0' : 8,
        padding: '8px 12px',
        transition: 'border-color 0.15s',
      }}>
        {/* Magnifying glass icon */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={visible}
          aria-autocomplete="list"
          aria-controls="goal-search-listbox"
          aria-activedescendant={activeIndex >= 0 ? `goal-search-item-${activeIndex}` : undefined}
          placeholder="Search goals…"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: T.mono, fontSize: 12, color: T.text,
            caretColor: T.orange,
          }}
        />

        {inputValue && (
          <button
            aria-label="Clear search"
            onClick={() => { setInputValue(''); setIsOpen(false); setActiveIndex(-1); inputRef.current?.focus() }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: T.muted, padding: 2, lineHeight: 1, fontSize: 13,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {visible && (
        <ul
          id="goal-search-listbox"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: T.surface, border: `1px solid ${T.border}`, borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            listStyle: 'none', margin: 0, padding: 0,
            maxHeight: 280, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {shown.length === 0 ? (
            <li style={{
              padding: '12px 14px', fontFamily: T.mono, fontSize: 12, color: T.muted,
              textAlign: 'center',
            }}>
              No goals match &ldquo;{debouncedQ}&rdquo;
            </li>
          ) : (
            <>
              {shown.map((goal, idx) => (
                <li
                  key={goal.id}
                  id={`goal-search-item-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={e => { e.preventDefault(); handleSelect(goal) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    background: idx === activeIndex ? `${T.indigo}18` : 'transparent',
                    borderBottom: idx < shown.length - 1 && !hasMore ? `1px solid ${T.border}` : undefined,
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
                    {goalEmoji(goal.goal_type)}
                  </span>
                  <span style={{
                    flex: 1, fontFamily: T.mono, fontSize: 12, color: T.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {goal.smart_title}
                  </span>
                  <span style={{
                    fontFamily: T.mono, fontSize: 10, color: T.muted,
                    flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {goal.status}
                  </span>
                </li>
              ))}

              {hasMore && (
                <li style={{
                  padding: '9px 14px',
                  fontFamily: T.mono, fontSize: 11, color: T.indigo,
                  textAlign: 'center', borderTop: `1px solid ${T.border}`,
                  cursor: 'default',
                }}>
                  Show all {results.length} results
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
