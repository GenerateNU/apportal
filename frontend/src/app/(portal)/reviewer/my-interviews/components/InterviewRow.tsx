'use client'

import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Clock, Mail } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/ui/toast'
import type { ApplicationStage } from '@/lib/api/types'
import {
  stageBadge,
  stageLabel,
} from '@/app/(portal)/reviewer/applications/components/constants'
import {
  REVIEW_STATE_BADGE,
  REVIEW_STATE_DOT,
  type ReviewState,
} from '../../my-reviews/constants'
import { INTERVIEW_STATE_LABEL } from '../constants'

// Same tracks as my-reviews' ReviewRow. This row can't reuse that component:
// there the row is a link into the app, here it's a button that copies the
// interviewee's address.
const GRID =
  'grid-cols-[1rem_minmax(0,1fr)_7rem_2rem] sm:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_5rem_7rem_2rem] lg:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_9.5rem_5rem_7rem_2rem]'

// How long the row stays ticked before the mail icon comes back.
const COPIED_FEEDBACK_MS = 1500

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function InterviewRow({
  name,
  email,
  stage,
  scheduledAt,
  state,
}: {
  name: string
  // Absent when the applicant has no address on file, which leaves the row
  // inert rather than offering a copy that yields nothing.
  email?: string
  stage?: ApplicationStage
  scheduledAt?: string
  state: ReviewState
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function copyEmail() {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      toast('Email copied', { variant: 'success' })
    } catch {
      // Clipboard access needs a secure context and can be blocked outright,
      // and a copy that silently does nothing is worse than saying so.
      toast('Could not copy — select the address instead', { variant: 'error' })
    }
  }

  const body = (
    <>
      <span
        className={`h-4 w-4 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
      />

      <span className="text-text-default min-w-0 truncate text-sm font-medium">
        {name}
      </span>
      <span className="text-text-subtle hidden min-w-0 truncate text-xs sm:block">
        {email}
      </span>

      {stage && (
        <span className="hidden lg:block">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${stageBadge[stage]}`}
          >
            {stageLabel[stage]}
          </span>
        </span>
      )}

      <span className="text-text-subtle hidden text-xs sm:flex">
        {scheduledAt && (
          <Tooltip label="Interview scheduled">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {shortDate(scheduledAt)}
            </span>
          </Tooltip>
        )}
      </span>

      <span className="flex">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE[state]}`}
        >
          {state === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
          {INTERVIEW_STATE_LABEL[state]}
        </span>
      </span>

      <span className="flex justify-end">
        {email &&
          (copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Mail className="text-text-faint group-hover:text-brand-blue h-4 w-4 transition-colors" />
          ))}
      </span>
    </>
  )

  const className = `group grid ${GRID} items-center gap-3 px-4 py-2.5 text-left transition-colors`

  // The whole row is the copy target — one action, so a plain button rather
  // than a control nested inside a clickable row.
  return email ? (
    <button
      type="button"
      onClick={copyEmail}
      title={`Copy ${email}`}
      className={`${className} w-full hover:bg-gray-50`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}
