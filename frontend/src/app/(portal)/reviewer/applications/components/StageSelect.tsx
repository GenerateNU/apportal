import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStage } from '@/lib/api/types'
import { useUpdateApplication } from '@/lib/queries/applications'
import { ORDERED_STAGES, stageBadge, stageLabel } from './constants'

// Wrapped in a click-swallowing div so it can be dropped into a clickable
// row/card (table row opens a detail drawer, kanban cards may later become
// clickable too) without picking the stage also triggering that.
export function StageSelect({
  applicationId,
  stage,
}: {
  applicationId: string
  stage: ApplicationStage
}) {
  const updateApplication = useUpdateApplication()

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <Select
        value={stage}
        onValueChange={(val) =>
          updateApplication.mutate({
            id: applicationId,
            body: { stage: val as ApplicationStage },
          })
        }
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
    </div>
  )
}
