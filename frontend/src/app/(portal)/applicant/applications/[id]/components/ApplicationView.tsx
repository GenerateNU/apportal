'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Lock } from 'lucide-react'
import type { Role } from '@/lib/api/types'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useApplication } from '@/lib/queries/applications'
import { useAnswers } from '@/lib/queries/answers'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { useSubmission } from '@/lib/queries/submissions'
import { ROLE_LABEL } from '@/lib/roles'
import { APPLICANT_STATUS } from '../../lib/status'
import { ApplicationFields } from '../../components/ApplicationFields'
import type { AnswerValue } from '../../components/QuestionField'

const noop = () => {}

// Read-only view of a submitted application. Applications are only created on
// submit, so anything with an id here is already submitted and locked.
export function ApplicationView({
  applicationId,
  cycleId,
  cycleName,
  role,
}: {
  applicationId: string
  cycleId: string
  cycleName: string
  role: Role
}) {
  const { data: application } = useApplication(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: submission } = useSubmission(applicationId)
  const { data: template } = useApplicationTemplate(cycleId, role)

  const values = useMemo(() => {
    const map: Record<string, AnswerValue> = {}
    for (const answer of answers) {
      const opts = answer.answer_options
      map[answer.question_id] = Array.isArray(opts)
        ? { options: opts as string[] }
        : { text: answer.answer_text ?? '' }
    }
    return map
  }, [answers])

  const status = application ? APPLICANT_STATUS[application.stage] : null

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-10">
      <Link
        href="/applicant/applications"
        className="text-text-muted hover:text-text-default mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} />
        My Applications
      </Link>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            {ROLE_LABEL[role]}
          </h1>
          <p className="text-text-muted mt-1 text-sm">{cycleName}</p>
        </div>
        {status && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
          >
            <Check size={12} />
            {status.label}
          </span>
        )}
      </header>

      <div className="border-border bg-muted/40 text-text-muted mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
        <Lock size={14} />
        You&apos;ve submitted this application. It can no longer be edited.
      </div>

      {template?.description && (
        <p className="text-text-muted mb-6 text-sm leading-relaxed whitespace-pre-wrap">
          {template.description}
        </p>
      )}

      <ApplicationFields
        questions={questions}
        challenge={challenges[0]}
        values={values}
        onValueChange={noop}
        resumeUrl={application?.resume_url ?? ''}
        onResumeChange={noop}
        availability={application?.availability ?? {}}
        onAvailabilityChange={noop}
        submissionUrl={submission?.submission_url ?? ''}
        onSubmissionChange={noop}
        disabled
      />

      {template?.instructions && (
        <p className="text-text-muted mt-6 text-sm leading-relaxed whitespace-pre-wrap">
          {template.instructions}
        </p>
      )}
    </div>
  )
}
