import { MarkdownContent } from '@/components/MarkdownContent'
import type { Question, Role } from '@/lib/api/types'
import { ROLE_LABEL } from '@/lib/roles'

function PreviewField({ question }: { question: Question }) {
  const options = question.options ?? []

  return (
    <div className="flex flex-col gap-2">
      <label className="text-text-secondary text-base font-medium">
        {question.question_text || 'Untitled question'}
        {question.is_required && <span className="text-red-500"> *</span>}
      </label>

      {(question.question_type === 'short_answer' ||
        question.question_type === 'url') && (
        <input
          placeholder={
            question.question_type === 'url'
              ? 'https://example.com'
              : 'Your answer'
          }
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-4 py-2.5 text-base outline-none focus:ring-1"
        />
      )}

      {question.question_type === 'long_answer' && (
        <textarea
          placeholder="Your answer"
          rows={3}
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-4 py-2.5 text-base outline-none focus:ring-1"
        />
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <label
              key={index}
              className="text-text-secondary flex items-center gap-2.5 text-base"
            >
              <input
                type="radio"
                name={question.id}
                className="accent-brand-blue h-4 w-4"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'checkbox' && (
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <label
              key={index}
              className="text-text-secondary flex items-center gap-2.5 text-base"
            >
              <input type="checkbox" className="accent-brand-blue h-4 w-4" />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function LivePreview({
  cycleName,
  role,
  questions,
  description,
  instructions,
}: {
  cycleName: string
  role: Role
  questions: Question[]
  description?: string
  instructions?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <p className="text-text-subtle text-sm">{ROLE_LABEL[role]}</p>
      <h2 className="text-text-default mb-8 text-xl font-semibold">
        {cycleName} Application
      </h2>

      {description && (
        <MarkdownContent className="text-text-secondary mb-8 text-base">
          {description}
        </MarkdownContent>
      )}

      <div className="flex flex-col gap-6">
        {questions.map((question) => (
          <PreviewField key={question.id} question={question} />
        ))}
        {questions.length === 0 && (
          <p className="text-text-subtle text-sm">
            This form has no questions yet.
          </p>
        )}
      </div>

      {instructions && (
        <MarkdownContent className="text-text-secondary mt-8 text-base">
          {instructions}
        </MarkdownContent>
      )}
    </div>
  )
}
