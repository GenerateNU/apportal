import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { APIError } from '@/lib/api/client'
import type { ApplicationStage } from '@/lib/api/types'
import { useUpdateApplication } from '@/lib/queries/applications'
import { ORDERED_STAGES, stageBadge, stageLabel } from './constants'

// Surfaces the backend's `detail` message (Huma error bodies), falling back
// to the raw error — a failed stage change (e.g. an expired session) would
// otherwise fail completely silently, since .mutate() has no default error UI.
function errorMessage(error: unknown): string {
  if (error instanceof APIError) {
    try {
      const body = JSON.parse(error.message) as {
        detail?: string
        title?: string
      }
      return body.detail || body.title || error.message
    } catch {
      return error.message
    }
  }
  return error instanceof Error ? error.message : String(error)
}

// Wrapped in a click-swallowing div so it can be dropped into a clickable
// row/card (table row opens a detail drawer, kanban cards may later become
// clickable too) without picking the stage also triggering that.
export function StageSelect({
  applicationId,
  stage,
  editable,
}: {
  applicationId: string
  stage: ApplicationStage
  // Changing stage is a chief decision (advance to interview, reject, etc.)
  // enforced by the backend — this only avoids showing a control that would
  // just 403 for anyone else. Required, not defaulted, so every call site
  // has to say explicitly who this is being rendered for.
  editable: boolean
}) {
  const updateApplication = useUpdateApplication()
  const [error, setError] = useState<string | null>(null)

  if (!editable) {
    return (
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadge[stage]}`}
      >
        {stageLabel[stage]}
      </span>
    )
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5"
    >
      <Select
        value={stage}
        onValueChange={(val) => {
          setError(null)
          updateApplication.mutate(
            { id: applicationId, body: { stage: val as ApplicationStage } },
            { onError: (err) => setError(errorMessage(err)) }
          )
        }}
      >
        <SelectTrigger
          className={`h-auto w-auto gap-1 rounded-full border-none px-2.5 py-1 text-xs font-semibold shadow-none hover:opacity-80 ${stageBadge[stage]}`}
        >
          <SelectValue>{stageLabel[stage]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ORDERED_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {stageLabel[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <AlertCircle
          size={14}
          className="text-destructive shrink-0"
          aria-label={`Couldn't update stage: ${error}`}
          role="img"
        >
          <title>{`Couldn't update stage: ${error}`}</title>
        </AlertCircle>
      )}
    </div>
  )
}
