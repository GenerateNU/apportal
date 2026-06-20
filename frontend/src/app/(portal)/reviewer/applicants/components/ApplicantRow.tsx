import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { stageBadge, stageLabel } from './constants'

export function ApplicantRow({
  applicant,
}: {
  applicant: ApplicantApplication
}) {
  return (
    <tr className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
      <td className="text-text-default px-4 py-3 text-sm font-medium">
        {applicant.fullName}
      </td>
      <td className="text-text-muted px-4 py-3 text-sm">{applicant.nuid}</td>
      <td className="text-text-muted px-4 py-3 text-sm">{applicant.email}</td>
      <td className="text-text-muted px-4 py-3 text-sm">
        {applicant.major ?? '—'}
      </td>
      <td className="text-text-muted px-4 py-3 text-sm">
        {applicant.graduationYear ?? '—'}
      </td>
      <td className="text-text-muted px-4 py-3 text-sm capitalize">
        {applicant.role.replace('_', ' ')}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadge[applicant.stage]}`}
        >
          {stageLabel[applicant.stage]}
        </span>
      </td>
      <td className="text-text-muted px-4 py-3 text-sm">
        {formatDate(applicant.submittedAt)}
      </td>
    </tr>
  )
}
