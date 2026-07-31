'use client'

import { FileText, Loader2 } from 'lucide-react'
import { useAnswerFileUrl } from '@/lib/queries/uploads'
import { cn } from '@/lib/utils'

// Renders a link to view an uploaded PDF answer, fetching a fresh signed
// Storage URL on mount (URLs are short-lived, so they're never persisted or
// reused across renders). Shared by the applicant form, the read-only
// submitted view, and the reviewer-facing table/review pages — anywhere a
// `url`-type question's file answer needs to be viewable.
export function FileAnswerLink({
  applicationId,
  questionId,
  fileName,
  className,
}: {
  applicationId: string
  questionId: string
  fileName?: string | null
  className?: string
}) {
  const { data, isLoading } = useAnswerFileUrl(applicationId, questionId, true)

  if (isLoading) {
    return (
      <span
        className={cn(
          'text-text-muted inline-flex items-center gap-1 text-sm',
          className
        )}
      >
        <Loader2 className="size-4 shrink-0 animate-spin" />
      </span>
    )
  }

  if (!data?.url) return null

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-text-muted hover:text-text-default inline-flex items-center gap-1 truncate text-sm transition-colors',
        className
      )}
      title={fileName ?? undefined}
    >
      <FileText className="size-4 shrink-0" />
      <span className="truncate">{fileName ?? 'View file'}</span>
    </a>
  )
}
