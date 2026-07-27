import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { formatDate } from '@/lib/utils'
import { stageBadge, stageLabel } from './constants'
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
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="text-text-default px-4 py-3 text-sm font-medium">
        {applicant.fullName}
      </td>
      <td className="text-text-muted px-4 py-3 text-sm">{applicant.nuid}</td>
      <td className="text-text-muted px-4 py-3 text-sm">{applicant.email}</td>
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
      {columns.map((q) => {
        const rowQuestion = rowQuestions.find(
          (rq) =>
            rq.question_text.trim().toLowerCase() ===
            q.question_text.trim().toLowerCase()
        )
        return (
          <td key={q.id} className="px-4 py-3">
            <AnswerCell
              answer={
                rowQuestion
                  ? answers.find((a) => a.question_id === rowQuestion.id)
                  : undefined
              }
              applicable={!!rowQuestion}
            />
          </td>
        )
      })}
    </tr>
  )
}
