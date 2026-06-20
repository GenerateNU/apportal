import type { ApplicantApplication } from './types'
import { ORDERED_STAGES } from './constants'
import { KanbanColumn } from './KanbanColumn'

export function KanbanView({ applicants }: { applicants: ApplicantApplication[] }) {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {ORDERED_STAGES.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          applicants={applicants.filter((a) => a.stage === stage)}
        />
      ))}
    </div>
  )
}
