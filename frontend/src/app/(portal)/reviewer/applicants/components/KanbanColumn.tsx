import type { Applicant, ApplicationStage } from '@/types/applicant'
import { stageDot, stageLabel } from './constants'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({
  stage,
  applicants,
}: {
  stage: ApplicationStage
  applicants: Applicant[]
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${stageDot[stage]}`} />
        <span className="text-sm font-semibold text-gray-800">{stageLabel[stage]}</span>
        <span className="text-sm text-gray-400">{applicants.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {applicants.map((a) => (
          <KanbanCard key={a.id} applicant={a} />
        ))}
        {applicants.length === 0 && <p className="px-1 text-xs text-gray-300">No applicants</p>}
      </div>
    </div>
  )
}
