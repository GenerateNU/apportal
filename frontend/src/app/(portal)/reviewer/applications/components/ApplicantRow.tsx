import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { stageDot, stageLabel, stageTextColor } from './constants'
import { AnswerCell } from './AnswerCell'

export function ApplicantRow({
  applicant,
  columns,
  rowQuestions,
  answers,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
}) {
  return (
    <tr className="border-b border-gray-100 bg-white hover:bg-gray-50">
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
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${stageTextColor[applicant.stage]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${stageDot[applicant.stage]}`}
          />
          {stageLabel[applicant.stage]}
        </span>
      </td>
      <td className="text-text-muted px-3 py-2 text-sm whitespace-nowrap">
        {formatDate(applicant.submittedAt)}
      </td>
    </tr>
  )
}
