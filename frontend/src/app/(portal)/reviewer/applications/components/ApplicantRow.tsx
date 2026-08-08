import type { ApplicationStage, Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'
import { useUpdateApplication } from '@/lib/queries/applications'
import { formatDate } from '@/lib/utils'
import {
  ORDERED_STAGES,
  stageDot,
  stageLabel,
  stageTextColor,
} from './constants'
import { AnswerCell } from './AnswerCell'

function availableSlots(
  availability: Record<string, boolean> | null | undefined
) {
  if (!availability) return []
  return AVAILABILITY_OPTIONS.filter((o) => availability[o.key]).map(
    (o) => o.label.split(' ')[0]
  )
}

export function ApplicantRow({
  applicant,
  columns,
  rowQuestions,
  answers,
  isSelected,
  onSelect,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
  isSelected: boolean
  onSelect: () => void
}) {
  const updateApplication = useUpdateApplication()
  const slots = availableSlots(applicant.availability)

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
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
      <td
        className="border-r border-gray-100 px-3 py-2 whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <Select
          value={applicant.stage}
          onValueChange={(val) =>
            updateApplication.mutate({
              id: applicant.id,
              body: { stage: val as ApplicationStage },
            })
          }
        >
          <SelectTrigger
            className={`h-auto w-auto gap-1.5 border-none bg-transparent px-1.5 py-1 text-sm font-medium shadow-none hover:bg-gray-100 ${stageTextColor[applicant.stage]}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${stageDot[applicant.stage]}`}
            />
            <SelectValue>{stageLabel[applicant.stage]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ORDERED_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stageLabel[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="text-text-muted px-3 py-2 text-sm whitespace-nowrap">
        {formatDate(applicant.submittedAt)}
      </td>
      <td className="text-text-muted px-3 py-2 text-sm whitespace-nowrap">
        {slots.length > 0 ? slots.join(', ') : '—'}
      </td>
    </tr>
  )
}
