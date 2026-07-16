'use client'

import { useRef, useState, type ReactNode } from 'react'

export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.top - 6, left: rect.left + rect.width / 2 })
  }

  return (
    <span
      ref={triggerRef}
      className="group relative inline-flex cursor-default"
      onMouseEnter={updatePosition}
    >
      {children}
      <span
        className="text-text-default pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100"
        style={{ top: position.top, left: position.left }}
      >
        {label}
      </span>
    </span>
  )
}
