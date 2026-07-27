import type { WrittenAnswer } from '@/lib/api/types'

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
}: {
  answer: WrittenAnswer | undefined
  applicable: boolean
}) {
  if (!applicable) {
    return <span className="text-text-faint text-xs">—</span>
  }

  const text = formatAnswer(answer)
  return (
    <span
      className="text-text-muted block max-w-50 truncate text-xs"
      title={text}
    >
      {text}
    </span>
  )
}
