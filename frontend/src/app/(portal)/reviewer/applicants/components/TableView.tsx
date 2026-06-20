import type { ApplicantApplication, ApplicationStage } from './types'
import { FILTER_STAGES } from './constants'
import { FilterBar } from './FilterBar'
import { ApplicantRow } from './ApplicantRow'

export function TableView({
  applicants,
  allApplicants,
  activeStage,
  onStageChange,
  allMajors,
  selectedMajors,
  onChangeMajors,
  allYears,
  selectedYears,
  onChangeYears,
}: {
  applicants: ApplicantApplication[]
  allApplicants: ApplicantApplication[]
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  allMajors: string[]
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  allYears: number[]
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
}) {
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all'
      ? allApplicants.length
      : allApplicants.filter((a) => a.stage === stage).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 px-4 py-3">
        {FILTER_STAGES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onStageChange(value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
        allMajors={allMajors}
        selectedMajors={selectedMajors}
        onChangeMajors={onChangeMajors}
        allYears={allYears}
        selectedYears={selectedYears}
        onChangeYears={onChangeYears}
      />

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Name', 'NUID', 'Email', 'Major', 'Year', 'Role', 'Stage', 'Submitted'].map(
              (col) => (
                <th
                  key={col}
                  className="text-text-subtle px-4 py-2.5 text-left text-xs font-medium tracking-wider uppercase"
                >
                  {col}
                </th>
              ),
            )}
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
