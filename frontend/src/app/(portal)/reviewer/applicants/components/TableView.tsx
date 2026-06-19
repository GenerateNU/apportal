import type { Applicant, ApplicationStage, Rating } from '@/types/applicant'
import { mockApplicants } from '@/lib/mock-applicants'
import { FILTER_STAGES } from './constants'
import { FilterBar } from './FilterBar'
import { ApplicantRow } from './ApplicantRow'

export function TableView({
  applicants,
  activeStage,
  onStageChange,
  selectedMajors,
  onChangeMajors,
  selectedYears,
  onChangeYears,
  selectedRatings,
  onChangeRatings,
}: {
  applicants: Applicant[]
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
  selectedRatings: Rating[]
  onChangeRatings: (v: Rating[]) => void
}) {
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all'
      ? mockApplicants.length
      : mockApplicants.filter((a) => a.stage === stage).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1 border-b border-gray-100 px-4 py-3">
        {FILTER_STAGES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onStageChange(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStage === value
                ? 'text-brand-blue bg-blue-50'
                : 'text-text-muted hover:text-text-secondary hover:bg-gray-100'
            }`}
          >
            {label}
            <span className="text-text-subtle ml-1.5 text-xs">
              {countByStage(value)}
            </span>
          </button>
        ))}
      </div>

      <FilterBar
        selectedMajors={selectedMajors}
        onChangeMajors={onChangeMajors}
        selectedYears={selectedYears}
        onChangeYears={onChangeYears}
        selectedRatings={selectedRatings}
        onChangeRatings={onChangeRatings}
      />

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {[
              'Name',
              'NUID',
              'Email',
              'Major',
              'Year',
              'Stage',
              'Rating',
              'Submitted',
            ].map((col) => (
              <th
                key={col}
                className="text-text-subtle px-4 py-2.5 text-left text-xs font-medium tracking-wider uppercase"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applicants.length > 0 ? (
            applicants.map((a) => <ApplicantRow key={a.id} applicant={a} />)
          ) : (
            <tr>
              <td
                colSpan={8}
                className="text-text-subtle px-4 py-10 text-center text-sm"
              >
                No applicants found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
