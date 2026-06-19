import type { Applicant } from '@/types/applicant'
import { formatDate } from '@/lib/utils'
import { stageBadge, stageLabel } from './constants'
import { RatingBadge } from './RatingBadge'

export function ApplicantRow({ applicant }: { applicant: Applicant }) {
  return (
    <tr className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {applicant.firstName} {applicant.lastName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.nuid}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.email}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.major}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.year}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadge[applicant.stage]}`}
        >
          {stageLabel[applicant.stage]}
        </span>
      </td>
      <td className="px-4 py-3">
        <RatingBadge applicant={applicant} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(applicant.submittedAt)}</td>
    </tr>
  )
}
