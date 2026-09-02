'use client'

import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { ROLE_CHIP_CLASS } from '@/lib/roles'
import { ROLE_LABEL } from '@/lib/roles'
import { KIND_LABEL, STATUS_BADGE, STATUS_LABEL, isDecided } from './constants'
import { DecisionEditor } from './DecisionEditor'

interface DecisionListRowProps {
  row: DecisionRow
  template?: DecisionTemplate
  cycleName: string
  cycleId: string
  // Open state is owned by the list, which keeps one row open at a time —
  // sending these is sequential work, so it hands over the next one after each.
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <ChevronRight
          size={16}
          className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <Avatar name={row.full_name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-text-default truncate text-sm font-medium">
              {row.full_name}
            </p>
            {!isDecided(row.stage) && (
              <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                Still in pipeline
              </span>
            )}
          </div>
          <p className="text-text-faint truncate text-xs">{row.email}</p>
        </div>

        <span
          className={`hidden shrink-0 rounded-md px-2 py-0.5 text-xs font-medium sm:inline ${ROLE_CHIP_CLASS[row.application_role]}`}
        >
          {ROLE_LABEL[row.application_role]}
        </span>
        <span className="text-text-muted hidden w-28 shrink-0 text-xs md:block">
          {KIND_LABEL[row.kind]}
        </span>
        {/* Who owes the paragraph — the column a chief scans to chase people. */}
        <span className="text-text-muted hidden w-36 shrink-0 truncate text-xs lg:block">
          {row.kind === 'rejection_post_interview'
            ? (row.interviewer_name ?? 'No interviewer')
            : '—'}
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
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
