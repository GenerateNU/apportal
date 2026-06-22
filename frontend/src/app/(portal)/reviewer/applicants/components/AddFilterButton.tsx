'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { FILTER_FIELDS, type FilterKey } from './constants'

export function AddFilterButton({
  activeKeys,
  onAdd,
}: {
  activeKeys: FilterKey[]
  onAdd: (key: FilterKey) => void
}) {
  const [panel, setPanel] = useState<null | 'fields'>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setPanel(null), panel !== null)

  const available = FILTER_FIELDS.filter((f) => !activeKeys.includes(f.key))

  if (available.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setPanel(panel ? null : 'fields')}
        className="text-text-subtle hover:text-text-secondary flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs transition-colors hover:border-gray-400"
      >
        <Plus className="h-3 w-3" />
        Filter
      </button>

      {panel === 'fields' && (
        <div className="absolute top-full left-0 z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="text-text-subtle border-b border-gray-100 px-3 py-2 text-xs font-medium tracking-wider uppercase">
            Filter by
          </div>
          <div className="py-1">
            {available.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => {
                  onAdd(key)
                  setPanel(null)
                }}
                className="text-text-secondary flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Icon className="text-text-subtle h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
