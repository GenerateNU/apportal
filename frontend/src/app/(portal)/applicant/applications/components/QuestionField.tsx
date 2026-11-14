'use client'

import { useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import { FileAnswerLink } from '@/components/FileAnswerLink'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

export type AnswerValue = {
  text?: string
  options?: string[]
  filePath?: string
  fileName?: string
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

// Lets a `url`-type question be answered either by typing a link or by
// uploading a PDF (e.g. a resume or portfolio that isn't hosted anywhere).
// applicationId is required to request an upload URL — until the draft has
// been saved once and has an id, uploading is disabled.
function UrlOrFileAnswer({
  applicationId,
  questionId,
  value,
  onChange,
  disabled,
  invalid,
}: {
  applicationId?: string
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
    if (!file || !applicationId) return
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
      const { path, upload_url } = await requestUploadUrl.mutateAsync({
        applicationId,
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
            disabled={!applicationId || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Paperclip size={14} />
            )}
            Upload a PDF instead
          </Button>
          {!applicationId && (
            <span className="text-text-subtle text-xs">
              Answer another question first to enable uploads
            </span>
          )}
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
}

const TEXTAREA_CLASS =
  'aria-invalid:border-destructive placeholder:text-text-subtle focus-visible:border-ink focus-visible:ring-ink/10 min-h-36 w-full resize-y border border-gray-300 bg-white px-3.5 py-3 text-base leading-relaxed transition-colors outline-none focus-visible:ring-3 disabled:bg-gray-50'

const OPTION_CLASS =
  'has-[:checked]:border-ink flex cursor-pointer items-center gap-3 border border-gray-200 bg-white px-4 py-3 text-base transition-colors hover:bg-gray-50 has-[:checked]:bg-gray-50 has-[:disabled]:cursor-default'

export function QuestionField({
  question,
  index,
  value,
  onChange,
  disabled = false,
  applicationId,
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
  error?: string
  onBlur?: () => void
}) {
  const options = question.options ?? []

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
            questionId={question.id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            invalid={!!error}
          />
        )}

        {question.question_type === 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <label key={option} className={OPTION_CLASS}>
                <input
                  type="radio"
                  name={question.id}
                  checked={value.text === option}
                  onChange={() => onChange({ text: option })}
                  disabled={disabled}
                  className="accent-ink h-4 w-4 shrink-0 cursor-pointer"
                />
                {option}
              </label>
            ))}
          </div>
        )}

        {question.question_type === 'score' && (
          <div className="flex flex-col gap-1">
            <Input
              type="number"
              min={1}
              max={10}
              step={1}
              className="h-11 w-24 text-base md:text-base"
              value={value.text ?? ''}
              onChange={(e) => onChange({ text: e.target.value })}
              aria-invalid={!!error}
              placeholder="1-10"
              disabled={disabled}
            />
            {value.text && !Number.isInteger(Number(value.text)) && (
              <p className="text-destructive text-xs">
                Rating must be a whole number.
              </p>
            )}
          </div>
        )}

        {question.question_type === 'dropdown' && (
          <Select
            value={value.text ?? ''}
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
        )}

        {question.question_type === 'checkbox' && (
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const selected = value.options ?? []
              const checked = selected.includes(option)
              return (
                <label key={option} className={OPTION_CLASS}>
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
                    className="accent-ink h-4 w-4 shrink-0 cursor-pointer"
                  />
                  {option}
                </label>
              )
            })}
          </div>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </Card>
  )
}
