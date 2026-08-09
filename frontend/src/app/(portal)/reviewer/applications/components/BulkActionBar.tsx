'use client'

import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStage } from '@/lib/api/types'
import { ORDERED_STAGES, stageLabel } from './constants'

// Takes over the table's filter row while rows are selected, so bulk actions
// appear where the selection was made instead of as a permanently docked bar
// that reads "0 selected" most of the time. Sized to match the filter chips it
// replaces so the row doesn't jump on the swap.
export function BulkActionBar({
  selectedCount,
  stage,
  onStageChange,
  onApply,
  onClear,
  applying,
  failedCount,
}: {
  selectedCount: number
  stage: ApplicationStage | ''
  onStageChange: (stage: ApplicationStage) => void
  onApply: () => void
  onClear: () => void
  applying: boolean
  failedCount: number
}) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-2">
      <span className="text-text-default text-sm font-medium">
        {selectedCount} selected
      </span>
      <button
        onClick={onClear}
        className="text-text-muted hover:text-text-default inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-sm transition-colors hover:bg-gray-100"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
      {failedCount > 0 && (
        <span className="text-destructive text-sm">
          {failedCount} update{failedCount === 1 ? '' : 's'} failed
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Select
          value={stage}
          onValueChange={(val) => onStageChange(val as ApplicationStage)}
        >
          <SelectTrigger className="h-7 w-44 rounded-md px-2 text-sm">
            <SelectValue placeholder="Move to stage…" />
          </SelectTrigger>
          <SelectContent>
            {ORDERED_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {stageLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onApply} disabled={!stage || applying}>
          {applying ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Updating…
            </>
          ) : (
            `Move ${selectedCount}`
          )}
        </Button>
      </div>
    </div>
  )
}
