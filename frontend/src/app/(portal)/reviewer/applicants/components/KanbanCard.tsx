import type { Applicant } from '@/types/applicant'
import { ratedStages, ratingBadge, ratingLabel } from './constants'

export function KanbanCard({ applicant }: { applicant: Applicant }) {
  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-text-default">
        {applicant.firstName} {applicant.lastName}
      </p>
      <p className="mt-0.5 text-xs text-text-subtle">{applicant.email}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="max-w-[130px] truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs text-text-secondary">
          {applicant.major}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-text-secondary">
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
