import type { Question, Role } from '@/lib/api/types'
import { ROLE_LABEL } from './constants'

function PreviewField({ question }: { question: Question }) {
  const options = question.options ?? []

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-secondary text-sm font-medium">
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
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      )}

      {question.question_type === 'long_answer' && (
        <textarea
          placeholder="Your answer"
          rows={3}
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="flex flex-col gap-1.5">
          {options.map((option, index) => (
            <label
              key={index}
              className="text-text-secondary flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={question.id}
                className="accent-brand-blue"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'checkbox' && (
        <div className="flex flex-col gap-1.5">
          {options.map((option, index) => (
            <label
              key={index}
              className="text-text-secondary flex items-center gap-2 text-sm"
            >
              <input type="checkbox" className="accent-brand-blue" />
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
}: {
  cycleName: string
  role: Role
  questions: Question[]
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-text-subtle text-xs">{ROLE_LABEL[role]}</p>
      <h2 className="text-text-default mb-6 text-lg font-semibold">
        {cycleName} Application
      </h2>

      <div className="flex flex-col gap-5">
        {questions.map((question) => (
          <PreviewField key={question.id} question={question} />
        ))}
        {questions.length === 0 && (
          <p className="text-text-subtle text-sm">
            This form has no questions yet.
          </p>
        )}
      </div>
    </div>
  )
}
