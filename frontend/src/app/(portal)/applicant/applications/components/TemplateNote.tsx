'use client'

import { useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Card } from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'
import { cn } from '@/lib/utils'

const COLLAPSE_AFTER_CHARS = 280

export function TemplateNote({
  label,
  children,
  className,
  expandable = true,
}: {
  label: string
  children: string
  className?: string
  expandable?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = expandable && children.length > COLLAPSE_AFTER_CHARS

  return (
    <Card variant="flat" padding="lg" className={className}>
      <SectionLabel as="h2" className="mb-2">
        {label}
      </SectionLabel>
      <div
        className={cn(
          'relative',
          collapsible && !expanded && 'max-h-28 overflow-hidden'
        )}
      >
        <MarkdownContent className="text-text-secondary text-sm leading-relaxed">
          {children}
        </MarkdownContent>
        {collapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" />
        )}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-display text-ink mt-2 text-[11px] tracking-wider uppercase underline-offset-4 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </Card>
  )
}
