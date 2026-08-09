import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { AnswerCell } from './AnswerCell'
import { StageSelect } from './StageSelect'

export function ApplicantRow({
  applicant,
  columns,
  rowQuestions,
  answers,
  availabilityDays,
  selectable,
  selected,
  onToggleSelect,
  isSelected,
  onSelect,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
  availabilityDays: string[]
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {selectable && (
        <td
          className="border-r border-gray-100 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${applicant.fullName}`}
          />
        </td>
      )}
      {columns.map((q) => {
        const rowQuestion = rowQuestions.find(
          (rq) =>
            rq.question_text.trim().toLowerCase() ===
            q.question_text.trim().toLowerCase()
        )
        return (
          <td
            key={q.id}
            className="border-r border-gray-100 px-3 py-2 last:border-r-0"
          >
            <AnswerCell
              answer={
                rowQuestion
                  ? answers.find((a) => a.question_id === rowQuestion.id)
                  : undefined
              }
              applicable={!!rowQuestion}
              questionType={q.question_type}
            />
          </td>
        )
      })}
      <td className="border-r border-gray-100 px-3 py-2 whitespace-nowrap">
        <StageSelect applicationId={applicant.id} stage={applicant.stage} />
      </td>
      <td className="text-text-muted px-3 py-2 text-sm whitespace-nowrap">
        {formatDate(applicant.submittedAt)}
      </td>
      <td className="border-r border-gray-100 px-3 py-2 whitespace-nowrap">
        {availabilityDays.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {availabilityDays.map((d) => (
              <span
                key={d}
                className="text-text-secondary inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium"
              >
                {d}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-text-faint text-sm">—</span>
        )}
      </td>
    </tr>
  )
}
