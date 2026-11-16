import type { ApplicationStage } from './types'
import type { ApplicantApplication } from './types'
import { stageDot, stageLabel } from './constants'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({
  stage,
  applicants,
  availabilityByApplicationId,
  editable,
  onOpen,
}: {
  stage: ApplicationStage
  applicants: ApplicantApplication[]
  availabilityByApplicationId: Record<string, string[]>
  editable: boolean
  onOpen: (applicationId: string) => void
}) {
  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${stageDot[stage]}`} />
        <span className="text-text-default text-sm font-semibold">
          {stageLabel[stage]}
        </span>
        <span className="text-text-subtle text-sm">{applicants.length}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {applicants.map((a) => (
          <KanbanCard
            key={a.id}
            applicant={a}
            availabilityDays={availabilityByApplicationId[a.id] ?? []}
            editable={editable}
            onOpen={() => onOpen(a.id)}
          />
        ))}
        {applicants.length === 0 && (
          <p className="text-text-faint px-1 text-xs">No applicants</p>
        )}
      </div>
    </div>
  )
}
