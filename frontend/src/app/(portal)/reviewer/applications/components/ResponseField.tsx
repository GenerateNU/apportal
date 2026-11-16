import type { Question, WrittenAnswer } from '@/lib/api/types'
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
    <div className="flex scroll-mt-6 flex-col gap-2 border-b border-gray-100 py-5 first:pt-0 last:border-b-0">
      <p className="font-display text-text-subtle text-[11px] font-bold tracking-wider uppercase">
        {question.question_text}
      </p>
      <div className="text-ink text-base leading-relaxed">
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
