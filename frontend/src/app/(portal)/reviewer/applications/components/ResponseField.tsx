import type { Question, WrittenAnswer } from '@/lib/api/types'
import { Label } from '@/components/ui/label'
import { AnswerCell } from './AnswerCell'
import { Card } from '@/components/ui/card'

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
    <Card className="flex scroll-mt-6 flex-col gap-3 p-5">
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
    </Card>
  )
}
