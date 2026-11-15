'use client'

import type { AnyFieldApi } from '@tanstack/react-form'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PAGE_R } from '@/components/ui/page-shell'
import { APIError } from '@/lib/api/client'
import { cn, formatDate } from '@/lib/utils'
import { useSettledValue } from '@/app/(portal)/applicant/applications/lib/url'
import { visibleError } from '@/app/(portal)/applicant/applications/lib/validation'
import { REVIEWED_TEXT } from '../../../my-reviews/constants'

export const TEXTAREA_CLASS =
  'aria-invalid:border-destructive placeholder:text-text-subtle focus-visible:border-ink focus-visible:ring-ink/10 min-h-40 lg:min-h-28 w-full resize-y border border-gray-300 bg-white px-3.5 py-3 text-base leading-relaxed transition-colors outline-none focus-visible:ring-3 disabled:bg-gray-50'

export function saveErrorMessage(err: unknown) {
  return err instanceof APIError && err.status === 409
    ? "This write-up was already submitted and can't be changed."
    : "Couldn't save your write-up. Please try again."
}

export function FormField({
  field,
  label,
  required,
  hint,
  children,
}: {
  field: AnyFieldApi
  label: string
  required?: boolean
  hint?: React.ReactNode
  children: (invalid: boolean) => React.ReactNode
}) {
  const value = String(field.state.value ?? '')
  const settled = useSettledValue(value) === value
  const error = visibleError(field, settled, false, !!value.trim())
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <Label>{label}</Label>
        {required && (
          <span className="font-display text-destructive shrink-0 text-[10px] tracking-wider uppercase">
            Required
          </span>
        )}
      </div>
      {children(!!error)}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {hint}
    </div>
  )
}

export function LinkValue({ href }: { href?: string | null }) {
  if (!href) return <p className="text-text-faint text-sm">Not added yet.</p>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-ink inline-flex items-center gap-1 text-sm break-all hover:underline"
    >
      {href}
      <ExternalLink size={12} className="shrink-0" />
    </a>
  )
}

export function FormFooter({
  answered,
  total,
  invalid,
  saved,
  saveError,
  pending,
  draftDisabled,
  onSaveDraft,
  onSubmit,
  submitLabel,
  submittedAt,
  draftLabel = 'Save draft',
}: {
  answered: number
  total: number
  invalid: boolean
  saved: boolean
  saveError: string | null
  pending: boolean
  draftDisabled: boolean
  onSaveDraft: () => void
  onSubmit: () => void
  submitLabel: string
  submittedAt?: string | null
  draftLabel?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-stretch gap-3 border-t border-gray-200 bg-white py-4 pl-6 sm:flex-row sm:items-center sm:justify-end sm:pl-8',
        PAGE_R
      )}
    >
      <span
        className={cn(
          'text-sm sm:mr-auto',
          invalid ? 'text-text-muted' : 'text-status-open'
        )}
      >
        {invalid
          ? `${answered} of ${total} answered`
          : submittedAt
            ? `Submitted ${formatDate(submittedAt)}`
            : 'Ready to submit'}
      </span>
      {saveError ? (
        <span className="text-destructive text-sm">{saveError}</span>
      ) : (
        saved &&
        !pending && (
          <span
            className={`inline-flex items-center gap-1 text-sm ${REVIEWED_TEXT}`}
          >
            <Check size={14} />
            {submittedAt ? 'Changes saved' : 'Draft saved'}
          </span>
        )
      )}
      <Button
        variant="outline"
        onClick={onSaveDraft}
        disabled={pending || draftDisabled}
        className="w-full sm:w-auto"
      >
        {draftLabel}
      </Button>
      <Button
        onClick={onSubmit}
        disabled={pending || invalid}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  )
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
  description = "Once submitted, you can't change it.",
  title = 'Submit your write-up?',
  confirmLabel = 'Submit',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: () => void
  description?: string
  title?: string
  confirmLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
