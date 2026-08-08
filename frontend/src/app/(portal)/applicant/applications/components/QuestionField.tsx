'use client'

import { useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import { FileAnswerLink } from '@/components/FileAnswerLink'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
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
}: {
  applicationId?: string
  questionId: string
  value: AnswerValue
  onChange: (next: AnswerValue) => void
  disabled: boolean
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
      <div className="flex items-center gap-3">
        <FileAnswerLink
          applicationId={applicationId}
          questionId={questionId}
          fileName={value.fileName}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-text-subtle hover:text-destructive"
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
        className="h-11 text-base md:text-base"
        value={value.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="https://…"
        disabled={disabled}
      />
      {!disabled && (
        <div className="flex items-center gap-2">
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
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-base transition-all outline-none focus-visible:ring-3 hover:border-gray-300 resize-none'

export function QuestionField({
  question,
  index,
  value,
  onChange,
  disabled = false,
  applicationId,
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

      {question.description && (
        <MarkdownContent className="text-text-muted -mt-2 gap-2 text-sm">
          {question.description}
        </MarkdownContent>
      )}

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
        <UrlOrFileAnswer
          applicationId={applicationId}
          questionId={question.id}
          value={value}
          onChange={onChange}
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

      {question.question_type === 'score' && (
        <Input
          type="number"
          min={1}
          max={10}
          className="h-11 w-24 text-base md:text-base"
          value={value.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="1-10"
          disabled={disabled}
        />
      )}

      {question.question_type === 'dropdown' && (
        <Select
          value={value.text ?? ''}
          onValueChange={(val) => onChange({ text: val })}
          disabled={disabled}
        >
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
