import type { Applicant } from '@/types/applicant'
import { ratedStages, ratingBadge, ratingLabel } from './constants'

export function RatingBadge({ applicant }: { applicant: Applicant }) {
  if (!ratedStages.includes(applicant.stage) || !applicant.rating) {
    return <span className="text-sm text-text-faint">—</span>
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ratingBadge[applicant.rating]}`}
    >
      {ratingLabel[applicant.rating]}
    </span>
  )
}
