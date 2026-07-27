import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication, ApplicationStage } from './types'
import { FILTER_STAGES } from './constants'
import { ApplicantRow } from './ApplicantRow'

const BASE_COLUMNS = ['Name', 'NUID', 'Email', 'Role', 'Stage', 'Submitted']

export function TableView({
  applicants,
  allApplicants,
  activeStage,
  onStageChange,
  columns,
  questionsByCycleRole,
  answersByApplicationId,
}: {
  applicants: ApplicantApplication[]
  allApplicants: ApplicantApplication[]
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  columns: Question[]
  questionsByCycleRole: Record<string, Question[]>
  answersByApplicationId: Record<string, WrittenAnswer[]>
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-180">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {BASE_COLUMNS.map((col) => (
                <th
                  key={col}
                  className="text-text-subtle px-4 py-2.5 text-left text-xs font-medium tracking-wider uppercase"
                >
                  {col}
                </th>
              ))}
              {columns.map((q) => (
                <th
                  key={q.id}
                  title={q.question_text}
                  className="text-text-subtle max-w-50 truncate px-4 py-2.5 text-left text-xs font-medium tracking-wider uppercase"
                >
                  {q.question_text}
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
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={BASE_COLUMNS.length + columns.length}
                  className="text-text-subtle px-4 py-10 text-center text-sm"
                >
                  No applicants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
