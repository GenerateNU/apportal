import type { ApplicantApplication } from './types'
import { ORDERED_STAGES } from './constants'
import { KanbanColumn } from './KanbanColumn'

export function KanbanView({
  applicants,
  availabilityByApplicationId,
  editable,
}: {
  applicants: ApplicantApplication[]
  availabilityByApplicationId: Record<string, string[]>
  editable: boolean
}) {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {ORDERED_STAGES.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          applicants={applicants.filter((a) => a.stage === stage)}
          availabilityByApplicationId={availabilityByApplicationId}
          editable={editable}
        />
      ))}
    </div>
  )
}
