import type { ApplicantApplication } from './types'

export function KanbanCard({ applicant }: { applicant: ApplicantApplication }) {
  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-text-default text-sm font-medium">
        {applicant.fullName}
      </p>
      <p className="text-text-subtle mt-0.5 text-xs">{applicant.email}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {applicant.major && (
          <span className="text-text-secondary max-w-[130px] truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            {applicant.major}
          </span>
        )}
        {applicant.graduationYear && (
          <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            Year {applicant.graduationYear}
          </span>
        )}
        <span className="text-text-secondary rounded bg-gray-100 px-1.5 py-0.5 text-xs capitalize">
          {applicant.role.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}
