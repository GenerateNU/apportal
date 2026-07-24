'use client'

import { useState } from 'react'
import type { Role } from '@/lib/api/types'
import { useUpdateApplicationTemplate } from '@/lib/queries/application-templates'

// Editable free-text block shown before/after the question list in the
// builder — persists to ApplicationTemplate.description (before) or
// .instructions (after), which the applicant-facing form renders in the same
// positions.
export function TemplateTextBlock({
  cycleId,
  role,
  field,
  label,
  placeholder,
  value,
}: {
  cycleId: string
  role: Role
  field: 'description' | 'instructions'
  label: string
  placeholder: string
  value?: string
}) {
  const updateTemplate = useUpdateApplicationTemplate()

  const persisted = value ?? ''
  const [prevValue, setPrevValue] = useState(persisted)
  const [text, setText] = useState(persisted)
  if (persisted !== prevValue) {
    setPrevValue(persisted)
    setText(persisted)
  }

  function commit() {
    const trimmed = text.trim()
    if (trimmed === persisted) return
    updateTemplate.mutate({
      cycleId,
      role,
      body:
        field === 'description'
          ? { description: trimmed }
          : { instructions: trimmed },
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-5">
      <p className="text-text-subtle mb-2 text-sm font-medium">{label}</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        rows={3}
        className="text-text-default w-full resize-y rounded-md border border-transparent px-1.5 py-1 text-base outline-none hover:border-gray-200 focus:border-gray-300"
      />
      <p className="text-text-faint mt-1 text-xs">
        Supports Markdown — # Header, ## Subheader, **bold**, _italic_, - lists,
        [links](url).
      </p>
    </div>
  )
}
