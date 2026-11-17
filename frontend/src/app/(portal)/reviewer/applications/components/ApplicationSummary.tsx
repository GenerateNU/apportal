'use client'

import { ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { PositionSummary } from '@/generated/model'

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function closes(iso?: string) {
  if (!iso) return 'No deadline set'
  const date = new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const days = daysUntil(iso)
  if (days < 0) return `Closed ${date}`
  if (days === 0) return `Closes today, ${date}`
  return `Closes in ${days} day${days === 1 ? '' : 's'}, ${date}`
}

export function ApplicationSummary({
  positions,
}: {
  positions: PositionSummary[]
}) {
  if (positions.length === 0) return null
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
      {positions.map((p) => (
        <Card key={p.role_id} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-ink truncate font-semibold">{p.role_name}</h3>
            <span className="text-text-muted shrink-0 text-xs">
              {closes(p.closes_at)}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="flex items-baseline gap-2">
              <span className="font-display text-ink text-3xl font-bold">
                {p.submitted}
              </span>
              <span className="text-text-muted text-sm">applied</span>
            </span>
            {p.new_day > 0 && (
              <span className="flex items-center gap-0.5 text-sm font-medium text-green-700">
                <ArrowUp size={14} />
                {p.new_day} today
              </span>
            )}
          </div>
          <p className="text-text-muted text-sm">{p.new_week} new this week</p>
        </Card>
      ))}
    </div>
  )
}
