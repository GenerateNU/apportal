'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Question } from '@/lib/api/types'

export type AnswerValue = { text?: string; options?: string[] }

const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3'

export function QuestionField({
  question,
  value,
  onChange,
  disabled = false,
}: {
  question: Question
  value: AnswerValue
  onChange: (next: AnswerValue) => void
  disabled?: boolean
}) {
  const options = question.options ?? []

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-text-default">
        {question.question_text}
        {question.is_required && <span className="text-destructive"> *</span>}
      </Label>

      {question.question_type === 'short_answer' && (
        <Input
          value={value.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Your answer"
          disabled={disabled}
        />
      )}

      {question.question_type === 'long_answer' && (
        <textarea
          className={TEXTAREA_CLASS}
          value={value.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Your answer"
          disabled={disabled}
        />
      )}

      {question.question_type === 'url' && (
        <Input
          type="url"
          value={value.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="https://…"
          disabled={disabled}
        />
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <label
              key={option}
              className="text-text-default flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={question.id}
                checked={value.text === option}
                onChange={() => onChange({ text: option })}
                disabled={disabled}
                className="accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'checkbox' && (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => {
            const selected = value.options ?? []
            const checked = selected.includes(option)
            return (
              <label
                key={option}
                className="text-text-default flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      options: checked
                        ? selected.filter((o) => o !== option)
                        : [...selected, option],
                    })
                  }
                  disabled={disabled}
                  className="accent-primary"
                />
                {option}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
