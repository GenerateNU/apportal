'use client'

import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.top - 6, left: rect.left + rect.width / 2 })
  }

  function hide() {
    setPosition(null)
  }

  return (
    <span
      ref={triggerRef}
      className="inline-flex cursor-default"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {position &&
        createPortal(
          <span
            className="text-text-default pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  )
}
