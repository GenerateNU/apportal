import { ExternalLink } from 'lucide-react'
import type { WrittenAnswer, QuestionType } from '@/lib/api/types'

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
}: {
  answer: WrittenAnswer | undefined
  applicable: boolean
  questionType?: QuestionType
}) {
  if (!applicable) {
    return <span className="text-text-faint text-xs">—</span>
  }

  const text = formatAnswer(answer)
  const isUrl = questionType === 'url' && answer && answer.answer_text?.trim()

  if (isUrl) {
    return (
      <a
        href={answer.answer_text}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-muted hover:text-text-default inline-flex max-w-50 items-center gap-1 truncate text-xs transition-colors"
        title={answer.answer_text}
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{answer.answer_text}</span>
      </a>
    )
  }

  return (
    <span
      className="text-text-muted block max-w-50 truncate text-xs"
      title={text}
    >
      {text}
    </span>
  )
}
