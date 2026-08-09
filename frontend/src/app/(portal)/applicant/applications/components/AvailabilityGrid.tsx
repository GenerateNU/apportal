'use client'

import { AVAILABILITY_OPTIONS as OPTIONS } from '@/lib/availability'

export function AvailabilityGrid({
  value,
  onChange,
  disabled = false,
}: {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  disabled?: boolean
}) {
  function toggle(key: string) {
    if (disabled) return
    onChange({ ...value, [key]: !value[key] })
  }

  return (
    <div>
      <p className="text-text-muted mb-3 text-sm">
        Select the meeting times you&apos;re available for during the semester.
      </p>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.key}
            className="text-text-default flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={!!value[option.key]}
              onChange={() => toggle(option.key)}
              disabled={disabled}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}
