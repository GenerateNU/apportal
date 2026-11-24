'use client'

import { useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import { FileAnswerLink } from '@/components/FileAnswerLink'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScoreScale } from '@/components/ui/score-scale'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { QuestionType } from '@/lib/api/types'
import { normalizeUrl } from '../lib/url'
import { cn } from '@/lib/utils'
import {
  useRequestUploadUrl,
  uploadFileToSignedUrl,
} from '@/lib/queries/uploads'
import {
  isOtherOption,
  matchesOption,
  otherDetail,
  withOtherDetail,
} from '../lib/other-option'

export type AnswerValue = {
  text?: string
  options?: string[]
  filePath?: string
  fileName?: string
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

// Lets a `url`-type question be answered either by typing a link or by
// uploading a PDF (e.g. a resume or portfolio that isn't hosted anywhere).
function UrlOrFileAnswer({
  applicationId,
  ensureApplicationId,
  questionId,
  value,
  onChange,
  disabled,
  invalid,
}: {
  applicationId?: string
  ensureApplicationId?: () => Promise<string>
  questionId: string
  value: AnswerValue
  onChange: (next: AnswerValue) => void
  disabled: boolean
  invalid: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestUploadUrl = useRequestUploadUrl()

  async function handleFileSelected(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File must be 10MB or smaller.')
      return
    }
    setUploading(true)
    try {
      const id = applicationId ?? (await ensureApplicationId?.())
      if (!id) throw new Error('no application')
      const { path, upload_url } = await requestUploadUrl.mutateAsync({
        applicationId: id,
        questionId,
        filename: file.name,
      })
      await uploadFileToSignedUrl(upload_url, file)
      onChange({ filePath: path, fileName: file.name })
    } catch {
      setError("Couldn't upload file. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  if (value.filePath && applicationId) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <FileAnswerLink
          applicationId={applicationId}
          questionId={questionId}
          fileName={value.fileName}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-text-subtle hover:text-destructive -m-2 shrink-0 p-2"
            aria-label="Remove file"
          >
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="url"
        inputMode="url"
        className="h-11 text-base md:text-base"
        value={value.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
        onBlur={() => {
          const normalized = normalizeUrl(value.text ?? '')
          if (normalized !== (value.text ?? '')) onChange({ text: normalized })
        }}
        aria-invalid={invalid}
        placeholder="https://…"
        disabled={disabled}
      />
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            aria-label="Upload a PDF"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Paperclip size={14} />
            )}
            Upload a PDF instead
          </Button>
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

// Minimal shape — satisfied by both Question and ReviewQuestion, so this one
// component renders/edits answers for either. description is optional because
// only ReviewQuestion has one.
export type FieldQuestion = {
  id: string
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options: string[] | null
  description?: string | null
  score_min?: number
  score_max?: number
}

const TEXTAREA_CLASS =
  'aria-invalid:border-destructive placeholder:text-text-subtle focus-visible:border-ink focus-visible:ring-ink/10 min-h-36 w-full resize-y border border-gray-300 bg-white px-3.5 py-3 text-base leading-relaxed transition-colors outline-none focus-visible:ring-3 disabled:bg-gray-50'

function OptionCard({
  checked,
  label,
  control,
  detail,
  disabled,
}: {
  checked: boolean
  label: string
  control: React.ReactNode
  detail?: { value: string; onChange: (value: string) => void }
  disabled: boolean
}) {
  return (
    <div
      className={cn(
        'border bg-white transition-colors',
        checked ? 'border-ink bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
      )}
    >
      <label
        className={cn(
          'flex items-center gap-3 px-4 py-3 text-base',
          disabled ? 'cursor-default' : 'cursor-pointer'
        )}
      >
        {control}
        {label}
      </label>
      {detail && (
        <div className="border-t border-gray-200 py-2.5 pr-4 pl-11">
          <input
            value={detail.value}
            onChange={(e) => detail.onChange(e.target.value)}
            placeholder="Please specify"
            aria-label={`${label}: please specify`}
            disabled={disabled}
            className="placeholder:text-text-subtle focus:border-ink w-full border-b border-gray-300 bg-transparent py-1.5 text-base outline-none"
          />
        </div>
      )}
    </div>
  )
}

export function QuestionField({
  question,
  index,
  value,
  onChange,
  disabled = false,
  applicationId,
  ensureApplicationId,
  error,
  onBlur,
}: {
  question: FieldQuestion
  index: number
  value: AnswerValue
  onChange: (next: AnswerValue) => void
  disabled?: boolean
  // Only used by the `url` branch's file-upload affordance — absent/unused
  // when this component renders review-question answers, which never use
  // the `url` type.
  applicationId?: string
  ensureApplicationId?: () => Promise<string>
  error?: string
  onBlur?: () => void
}) {
  const options = question.options ?? []
  const chosen = options.find((o) => matchesOption(value.text ?? '', o))
  const chosenOther = chosen && isOtherOption(chosen) ? chosen : undefined

  return (
    <Card
      onBlur={onBlur}
      id={`question-${question.id}`}
      padding="lg"
      className={cn(
        'focus-within:border-ink flex scroll-mt-24 flex-col gap-4 transition-colors'
      )}
    >
      <div className="flex items-start gap-4">
        <span className="font-display text-text-subtle pt-0.5 text-sm font-bold">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <Label className="text-ink text-base leading-snug font-semibold">
              {question.question_text}
            </Label>
            {question.is_required && (
              <span className="font-display text-destructive shrink-0 pt-1 text-[10px] tracking-wider uppercase">
                Required
              </span>
            )}
          </div>
          {question.description && (
            <MarkdownContent className="text-text-muted gap-2 text-sm">
              {question.description}
            </MarkdownContent>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:pl-9">
        {question.question_type === 'short_answer' && (
          <Input
            className="h-11 text-base md:text-base"
            value={value.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            aria-invalid={!!error}
            placeholder="Your answer"
            disabled={disabled}
          />
        )}

        {question.question_type === 'long_answer' && (
          <div className="flex flex-col gap-1">
            <textarea
              className={TEXTAREA_CLASS}
              value={value.text ?? ''}
              onChange={(e) => onChange({ text: e.target.value })}
              aria-invalid={!!error}
              placeholder="Your answer"
              disabled={disabled}
            />
            {!disabled && (
              <span className="text-text-subtle self-end text-xs">
                {(value.text ?? '').length} characters
              </span>
            )}
          </div>
        )}

        {question.question_type === 'url' && (
          <UrlOrFileAnswer
            applicationId={applicationId}
            ensureApplicationId={ensureApplicationId}
            questionId={question.id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            invalid={!!error}
          />
        )}

        {question.question_type === 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const checked = matchesOption(value.text ?? '', option)
              return (
                <OptionCard
                  key={option}
                  checked={checked}
                  label={option}
                  control={
                    <input
                      type="radio"
                      name={question.id}
                      checked={checked}
                      onChange={() => onChange({ text: option })}
                      disabled={disabled}
                      className="accent-ink h-4 w-4 shrink-0 cursor-pointer"
                    />
                  }
                  detail={
                    checked && isOtherOption(option)
                      ? {
                          value: otherDetail(value.text ?? '', option),
                          onChange: (d) =>
                            onChange({ text: withOtherDetail(option, d) }),
                        }
                      : undefined
                  }
                  disabled={disabled}
                />
              )
            })}
          </div>
        )}

        {question.question_type === 'score' && (
          <ScoreScale
            min={question.score_min}
            max={question.score_max}
            label={question.question_text}
            value={value.text ? Number(value.text) : undefined}
            onChange={(next) =>
              onChange(next === undefined ? {} : { text: String(next) })
            }
            disabled={disabled}
            invalid={!!error}
          />
        )}

        {question.question_type === 'dropdown' && (
          <div className="flex flex-col gap-2">
            <Select
              value={chosen ?? ''}
              onValueChange={(val) => onChange({ text: val })}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={question.question_text}
                aria-invalid={!!error}
              >
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
            {chosenOther && (
              <div className="flex flex-col gap-1.5 border-l-2 border-gray-200 pl-3">
                <label
                  htmlFor={`${question.id}-other`}
                  className="text-text-muted text-sm"
                >
                  Please specify
                </label>
                <Input
                  id={`${question.id}-other`}
                  className="h-11 text-base md:text-base"
                  value={otherDetail(value.text ?? '', chosenOther)}
                  onChange={(e) =>
                    onChange({
                      text: withOtherDetail(chosenOther, e.target.value),
                    })
                  }
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        )}

        {question.question_type === 'checkbox' && (
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const selected = value.options ?? []
              const entry = selected.find((o) => matchesOption(o, option))
              const checked = entry !== undefined
              return (
                <OptionCard
                  key={option}
                  checked={checked}
                  label={option}
                  control={
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          options: checked
                            ? selected.filter((o) => o !== entry)
                            : [...selected, option],
                        })
                      }
                      disabled={disabled}
                      className="accent-ink h-4 w-4 shrink-0 cursor-pointer"
                    />
                  }
                  detail={
                    checked && isOtherOption(option)
                      ? {
                          value: otherDetail(entry, option),
                          onChange: (d) =>
                            onChange({
                              options: selected.map((o) =>
                                o === entry ? withOtherDetail(option, d) : o
                              ),
                            }),
                        }
                      : undefined
                  }
                  disabled={disabled}
                />
              )
            })}
          </div>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </Card>
  )
}
