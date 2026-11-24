'use client'

import { useEffect, useRef, useState } from 'react'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'

export function TruncatedText({
  text,
  className,
  wrapperClassName,
}: {
  text: string
  className?: string
  wrapperClassName?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      setCut(el.scrollWidth > el.clientWidth)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return (
    <Tooltip label={text} disabled={!cut} className={wrapperClassName}>
      <span ref={ref} className={cn('block truncate', className)}>
        {text}
      </span>
    </Tooltip>
  )
}

export function TruncatedName({ name }: { name: string }) {
  return <TruncatedText text={name} className="max-w-40" />
}
