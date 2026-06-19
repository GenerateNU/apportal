import type { Applicant } from '@/types/applicant'
import { ratedStages, ratingBadge, ratingLabel } from './constants'

export function KanbanCard({ applicant }: { applicant: Applicant }) {
  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-text-default text-sm font-medium">
        {applicant.firstName} {applicant.lastName}
      </p>
      <p className="text-text-subtle mt-0.5 text-xs">{applicant.email}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="text-text-secondary max-w-[130px] truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          {applicant.major}
        </span>
        <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          Year {applicant.year}
        </span>
        {applicant.rating && ratedStages.includes(applicant.stage) && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ratingBadge[applicant.rating]}`}
          >
            {ratingLabel[applicant.rating]}
          </span>
        )}
      </div>
    </div>
  )
}
