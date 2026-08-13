import type { ApplicantApplication } from './types'
import { StageSelect } from './StageSelect'

export function KanbanCard({
  applicant,
  availabilityDays,
  editable,
}: {
  applicant: ApplicantApplication
  availabilityDays: string[]
  editable: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-text-default truncate text-sm font-medium">
        {applicant.fullName}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs capitalize">
          {applicant.role.replace('_', ' ')}
        </span>
        {availabilityDays.map((d) => (
          <span
            key={d}
            className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-2.5">
        <StageSelect
          applicationId={applicant.id}
          stage={applicant.stage}
          editable={editable}
        />
      </div>
    </div>
  )
}
