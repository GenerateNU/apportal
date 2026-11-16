'use client'

import { useEffect, useRef, useState } from 'react'
import { PAGE_X } from './page-shell'

type Box = { top: number; left: number; width: number }

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

export function StickyBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = scrollParent(el)
    const target: HTMLElement | Window = parent ?? window
    function update() {
      if (!el) return
      const frame = parent?.getBoundingClientRect() ?? {
        top: 0,
        left: 0,
        width: window.innerWidth,
      }
      const hidden = el.getBoundingClientRect().bottom <= frame.top
      setBox(
        hidden ? { top: frame.top, left: frame.left, width: frame.width } : null
      )
    }
    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <>
      <div ref={ref}>{children}</div>
      {box && (
        <div
          style={{ top: box.top, left: box.left, width: box.width }}
          className="fixed z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm"
        >
          <div className={`${PAGE_X} py-3`}>{children}</div>
        </div>
      )}
    </>
  )
}
