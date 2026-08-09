import { ExternalLink } from 'lucide-react'
import { FileAnswerLink } from '@/components/FileAnswerLink'
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
  loading = false,
}: {
  answer: WrittenAnswer | undefined
  applicable: boolean
  questionType?: QuestionType
  truncate?: boolean
  // The answers for this application are still in flight. Distinct from
  // having none, which is what an absent `answer` means once they land.
  loading?: boolean
}) {
  if (!applicable) {
    return <span className="text-text-faint text-sm">—</span>
  }

  // Blank rather than "No response": until the answers arrive we don't know
  // whether there is one, and claiming there isn't reads as a real answer.
  if (loading && !answer) {
    return null
  }

  const text = formatAnswer(answer)
  const isFile = questionType === 'url' && answer?.answer_file_path
  const isUrl = questionType === 'url' && answer && answer.answer_text?.trim()
  const isCheckbox =
    !truncate && questionType === 'checkbox' && answer?.answer_options

  if (isCheckbox) {
    return <ChipsResponse options={answer.answer_options} />
  }

  if (isFile) {
    return (
      <FileAnswerLink
        applicationId={answer.application_id}
        questionId={answer.question_id}
        fileName={answer.answer_file_name}
        className={truncate ? 'max-w-96 text-xs' : 'max-w-96 text-base'}
      />
    )
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
