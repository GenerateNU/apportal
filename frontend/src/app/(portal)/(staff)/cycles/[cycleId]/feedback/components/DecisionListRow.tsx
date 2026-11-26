'use client'

import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { STATUS_BADGE, STATUS_LABEL, isDecided } from './constants'
import { DecisionEditor } from './DecisionEditor'

interface DecisionListRowProps {
  row: DecisionRow
  template?: DecisionTemplate
  cycleName: string
  cycleId: string
  open: boolean
  onToggle: () => void
  onSent?: () => void
}

export function DecisionListRow({
  row,
  template,
  cycleName,
  cycleId,
  open,
  onToggle,
  onSent,
}: DecisionListRowProps) {
  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <ChevronRight
          size={16}
          className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-ink truncate text-sm font-medium">
              {row.full_name}
            </p>
            {!isDecided(row.stage) && (
              <Badge size="sm" className="bg-amber-50 text-amber-700">
                Not decided
              </Badge>
            )}
          </div>
          <p className="text-text-faint truncate text-xs">{row.email}</p>
        </div>
        <span className="text-text-muted hidden w-56 shrink-0 truncate text-xs sm:block">
          {row.kind === 'rejection_post_interview'
            ? `Interviewed by ${row.interviewers.map((iv) => iv.name).join(', ') || 'no one'}`
            : 'No interview'}
        </span>
        <Badge className={STATUS_BADGE[row.status]}>
          {STATUS_LABEL[row.status]}
        </Badge>
      </button>

      {open && (
        <DecisionEditor
          row={row}
          template={template}
          cycleName={cycleName}
          cycleId={cycleId}
          onSent={onSent}
        />
      )}
    </div>
  )
}
