import { ExternalLink } from 'lucide-react'
import type { WrittenAnswer, QuestionType } from '@/lib/api/types'
import { ChipsResponse } from './ChipsResponse'

function formatAnswer(answer: WrittenAnswer | undefined): string {
  if (!answer) return 'No response'
  if (answer.answer_options && answer.answer_options.length > 0) {
    return answer.answer_options.join(', ')
  }
  return answer.answer_text?.trim() || 'No response'
}

export function AnswerCell({
  answer,
  applicable,
  questionType,
  truncate = true,
}: {
  answer: WrittenAnswer | undefined
  applicable: boolean
  questionType?: QuestionType
  truncate?: boolean
}) {
  if (!applicable) {
    return <span className="text-text-faint text-sm">—</span>
  }

  const text = formatAnswer(answer)
  const isUrl = questionType === 'url' && answer && answer.answer_text?.trim()
  const isCheckbox =
    !truncate && questionType === 'checkbox' && answer?.answer_options

  if (isCheckbox) {
    return <ChipsResponse options={answer.answer_options} />
  }

  if (isUrl) {
    return (
      <a
        href={answer.answer_text}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-text-muted hover:text-text-default inline-flex max-w-96 items-center gap-1 truncate transition-colors ${
          truncate ? 'text-xs' : 'text-base'
        }`}
        title={answer.answer_text}
      >
        <ExternalLink className="size-4 shrink-0" />
        <span className="truncate">{answer.answer_text}</span>
      </a>
    )
  }

  return (
    <span
      className={`text-text-muted block ${
        truncate ? 'max-w-50 truncate text-xs' : 'text-base break-words'
      }`}
      title={text}
    >
      {text}
    </span>
  )
}
