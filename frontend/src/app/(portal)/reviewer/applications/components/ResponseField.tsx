import type { Question, WrittenAnswer } from '@/lib/api/types'
import { Label } from '@/components/ui/label'
import { AnswerCell } from './AnswerCell'

export function ResponseField({
  question,
  answer,
  applicable,
  loading,
}: {
  question: Question
  answer: WrittenAnswer | undefined
  applicable: boolean
  loading?: boolean
}) {
  return (
    <div className="flex scroll-mt-6 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <Label className="text-base">{question.question_text}</Label>

      <div className="text-lg">
        <AnswerCell
          answer={answer}
          applicable={applicable}
          questionType={question.question_type}
          truncate={false}
          loading={loading}
        />
      </div>
    </div>
  )
}
