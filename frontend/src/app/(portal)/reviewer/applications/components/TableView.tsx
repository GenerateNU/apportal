import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication, ApplicationStage } from './types'
import { FILTER_STAGES } from './constants'
import { ApplicantRow } from './ApplicantRow'

const TRAILING_COLUMNS = ['Stage', 'Submitted', 'Availability']

export function TableView({
  applicants,
  allApplicants,
  activeStage,
  onStageChange,
  columns,
  questionsByCycleRole,
  answersByApplicationId,
  selectedApplicationId,
  onSelectApplication,
}: {
  applicants: ApplicantApplication[]
  allApplicants: ApplicantApplication[]
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  columns: Question[]
  questionsByCycleRole: Record<string, Question[]>
  answersByApplicationId: Record<string, WrittenAnswer[]>
  selectedApplicationId: string | null
  onSelectApplication: (id: string) => void
}) {
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all'
      ? allApplicants.length
      : allApplicants.filter((a) => a.stage === stage).length

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-100 px-4 py-3">
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

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="h-full w-full min-w-180">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((q) => (
                <th
                  key={q.id}
                  title={q.question_text}
                  className="text-text-muted max-w-50 truncate border-r border-gray-100 px-3 py-2 text-left text-xs font-medium last:border-r-0"
                >
                  {q.question_text}
                </th>
              ))}
              {TRAILING_COLUMNS.map((label) => (
                <th
                  key={label}
                  className="text-text-muted border-r border-gray-100 px-3 py-2 text-left text-xs font-medium whitespace-nowrap last:border-r-0"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applicants.length > 0 ? (
              applicants.map((a) => (
                <ApplicantRow
                  key={a.id}
                  applicant={a}
                  columns={columns}
                  rowQuestions={
                    questionsByCycleRole[`${a.cycleId}:${a.role}`] ?? []
                  }
                  answers={answersByApplicationId[a.id] ?? []}
                  isSelected={selectedApplicationId === a.id}
                  onSelect={() => onSelectApplication(a.id)}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + TRAILING_COLUMNS.length}
                  className="text-text-subtle px-4 py-10 text-center text-sm"
                >
                  No applicants found.
                </td>
              </tr>
            )}
            {/* Fills any leftover height in the box with the same column
                gridlines, so they run to the bottom instead of stopping
                right after the last real row. */}
            <tr className="h-full">
              {Array.from({
                length: columns.length + TRAILING_COLUMNS.length,
              }).map((_, i) => (
                <td
                  key={i}
                  className="border-r border-gray-100 last:border-r-0"
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
