import type { Applicant } from '@/types/applicant'
import { ORDERED_STAGES } from './constants'
import { KanbanColumn } from './KanbanColumn'

export function KanbanView({ applicants }: { applicants: Applicant[] }) {
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
