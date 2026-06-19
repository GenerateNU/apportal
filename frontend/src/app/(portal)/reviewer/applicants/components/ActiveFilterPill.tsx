'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export function ActiveFilterPill<T extends string | number>({
  label,
  values,
  renderValue,
  options,
  onChange,
  onClear,
}: {
  label: string
  values: T[]
  renderValue: (v: T) => string
  options: T[]
  onChange: (next: T[]) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const toggle = (v: T) =>
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v]
    )

  const valueLabel =
    values.length === 1 ? renderValue(values[0]) : `${values.length} values`

  return (
    <div ref={ref} className="relative flex items-center">
      <div className="flex items-center rounded-md border border-gray-200 bg-white text-xs shadow-sm">
        <span className="px-2.5 py-1.5 font-medium text-gray-600">{label}</span>
        <span className="border-l border-gray-100 px-2 py-1.5 text-gray-400">
          is
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="border-l border-gray-100 px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          {valueLabel}
        </button>
        <button
          onClick={onClear}
          className="rounded-r-md border-l border-gray-100 px-2 py-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <label
              key={String(opt)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={values.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              {renderValue(opt)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
