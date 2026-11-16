'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const MIN = 30
const MAX = 70
const DEFAULT = 50

function clamp(value: number) {
  return Math.min(MAX, Math.max(MIN, value))
}

// Two columns with a draggable divider on desktop; stacked below lg.
export function ResizableSplit({
  storageKey,
  left,
  right,
  className,
}: {
  storageKey: string
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState(DEFAULT)

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setSplit(clamp(stored))
    } catch {}
  }, [storageKey])

  function commit(value: number) {
    const next = clamp(value)
    setSplit(next)
    try {
      localStorage.setItem(storageKey, String(Math.round(next)))
    } catch {}
  }

  function startDrag(event: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    let latest = split
    const move = (e: PointerEvent) => {
      latest = clamp(((e.clientX - rect.left) / rect.width) * 100)
      setSplit(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.removeProperty('user-select')
      commit(latest)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={containerRef}
      style={{ '--split': `${split}%` } as React.CSSProperties}
      className={cn(
        'grid grid-cols-1 lg:grid-cols-[minmax(0,var(--split))_9px_minmax(0,1fr)]',
        className
      )}
    >
      {left}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(split)}
        aria-label="Resize columns"
        tabIndex={0}
        onPointerDown={startDrag}
        onDoubleClick={() => commit(DEFAULT)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') commit(split - 2)
          if (e.key === 'ArrowRight') commit(split + 2)
        }}
        className="group focus-visible:bg-ink/10 relative hidden cursor-col-resize outline-none hover:bg-gray-100 lg:block"
      >
        <span className="group-hover:bg-ink absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200 transition-colors" />
      </div>
      {right}
    </div>
  )
}
