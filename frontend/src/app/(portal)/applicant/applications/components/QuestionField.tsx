'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Question } from '@/lib/api/types'

export type AnswerValue = { text?: string; options?: string[] }

const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-base transition-all outline-none focus-visible:ring-3 hover:border-gray-300 resize-none'

export function QuestionField({
  question,
  index,
  value,
  onChange,
  disabled = false,
}: {
  question: Question
  index: number
  value: AnswerValue
  onChange: (next: AnswerValue) => void
  disabled?: boolean
}) {
  const options = question.options ?? []

  return (
    <div
      id={`question-${question.id}`}
      className="flex scroll-mt-6 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <Label className="text-base">
        {index + 1}. {question.question_text}
        {question.is_required && <span className="text-destructive"> *</span>}
      </Label>

      {question.question_type === 'short_answer' && (
        <Input
          className="h-11 text-base md:text-base"
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
          className="h-11 text-base md:text-base"
          value={value.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="https://…"
          disabled={disabled}
        />
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <label
              key={option}
              className="text-text-default hover:text-text-default flex cursor-pointer items-center gap-3 text-base transition-colors"
            >
              <input
                type="radio"
                name={question.id}
                checked={value.text === option}
                onChange={() => onChange({ text: option })}
                disabled={disabled}
                className="accent-brand-blue h-4 w-4 cursor-pointer"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'dropdown' && (
        <Select value={value.text ?? ''} onValueChange={(val) => onChange({ text: val })} disabled={disabled}>
          <SelectTrigger aria-label={question.question_text}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {question.question_type === 'checkbox' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = value.options ?? []
            const checked = selected.includes(option)
            return (
              <label
                key={option}
                className="text-text-default hover:text-text-default flex cursor-pointer items-center gap-3 text-base transition-colors"
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
                  className="accent-brand-blue h-4 w-4 cursor-pointer"
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
