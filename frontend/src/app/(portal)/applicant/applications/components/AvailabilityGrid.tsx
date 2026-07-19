'use client'

// Availability for the club's weekly meeting times during the semester. Each
// option toggles a stable key in the JSONB availability blob stored on the
// application.
//
// TODO: these time options are hardcoded for now — they should eventually be
// configured per cycle in the application builder (admin), the same way
// questions and the code challenge are, rather than baked into the client.
const OPTIONS = [
  { key: 'monday_1800_1930', label: 'Monday 6:00–7:30 PM' },
  { key: 'tuesday_1930_2100', label: 'Tuesday 7:30–9:00 PM' },
  { key: 'wednesday_1800_1930', label: 'Wednesday 6:00–7:30 PM' },
  { key: 'thursday_1930_2100', label: 'Thursday 7:30–9:00 PM' },
] as const

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
