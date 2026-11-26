'use client'

import { ArrowUp } from 'lucide-react'
import type { PositionSummary } from '@/generated/model'

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function closes(iso?: string) {
  if (!iso) return 'No deadline'
  const date = new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const days = daysUntil(iso)
  if (days < 0) return `Closed ${date}`
  if (days === 0) return 'Closes today'
  return `${days}d left`
}

export function ApplicationSummary({
  positions,
}: {
  positions: PositionSummary[]
}) {
  if (positions.length === 0) return null
  return (
    <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1">
      {positions.map((p) => (
        <div
          key={p.role_id}
          className="flex w-52 shrink-0 flex-col gap-1 border border-gray-200 bg-white px-3 py-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink truncate text-xs font-semibold">
              {p.role_name}
            </span>
            <span className="text-text-subtle shrink-0 text-[11px]">
              {closes(p.closes_at)}
            </span>
          </div>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-display text-ink text-lg leading-none font-bold">
              {p.submitted}
            </span>
            <span className="text-text-muted">applied</span>
            {p.new_day > 0 ? (
              <span className="flex items-center gap-0.5 font-medium text-green-700">
                <ArrowUp size={12} />
                {p.new_day} today
              </span>
            ) : (
              p.new_week > 0 && (
                <span className="text-text-subtle">
                  +{p.new_week} this week
                </span>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
