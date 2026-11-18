'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// How long a tap-opened tooltip stays up, since touch has no mouseleave.
const TOUCH_DISMISS_MS = 1500
const GAP = 8

export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, flipped: false })
  const [open, setOpen] = useState(false)
  const [touchOpenedAt, setTouchOpenedAt] = useState<number | null>(null)

  useEffect(() => {
    if (touchOpenedAt === null) return
    const timer = setTimeout(() => setOpen(false), TOUCH_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [touchOpenedAt])

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = bubbleRef.current?.offsetWidth ?? 0
    const flipped =
      rect.right + GAP + width > window.innerWidth &&
      rect.left - GAP - width >= 0
    setPosition({
      top: rect.top + rect.height / 2,
      left: flipped ? rect.left - GAP : rect.right + GAP,
      flipped,
    })
    setOpen(true)
  }

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex cursor-default"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') show()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setOpen(false)
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        show()
        setTouchOpenedAt(e.timeStamp)
      }}
    >
      {children}
      <span
        ref={bubbleRef}
        className={`text-text-default pointer-events-none fixed z-50 -translate-y-1/2 ${position.flipped ? '-translate-x-full' : ''} rounded-md border border-gray-200 bg-white px-2 py-1 text-xs whitespace-nowrap shadow-sm transition-opacity duration-150 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: position.top, left: position.left }}
      >
        {label}
      </span>
    </span>
  )
}
