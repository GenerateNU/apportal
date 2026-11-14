'use client'

import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Badge, StatusDot } from '@/components/ui/badge'
import { BackLink } from '@/components/ui/back-link'
import { PageHeader } from '@/components/ui/page-header'
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
      if (Array.isArray(opts)) {
        map[answer.question_id] = { options: opts as string[] }
      } else if (answer.answer_file_path) {
        map[answer.question_id] = {
          filePath: answer.answer_file_path,
          fileName: answer.answer_file_name ?? undefined,
        }
      } else {
        map[answer.question_id] = { text: answer.answer_text ?? '' }
      }
    }
    return map
  }, [answers])

  const status = application ? APPLICANT_STATUS[application.stage] : null

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        className="mb-6"
        back={
          <BackLink href="/applicant/applications">My Applications</BackLink>
        }
        title={ROLE_LABEL[role]}
        subtitle={cycleName}
        actions={
          status && (
            <Badge className="text-text-subtle gap-1.5 bg-transparent">
              <StatusDot className="bg-gray-400" />
              {status.label}
            </Badge>
          )
        }
      />

      <div className="border-border bg-muted/40 text-text-muted mb-6 flex items-center gap-2 border px-4 py-3 text-sm">
        <Lock size={14} className="shrink-0" />
        You&apos;ve submitted this application. It can no longer be edited.
      </div>

      {template?.description && (
        <MarkdownContent className="text-text-muted mb-6 text-sm leading-relaxed">
          {template.description}
        </MarkdownContent>
      )}

      <ApplicationFields
        questions={questions}
        challenge={challenges[0]}
        values={values}
        onValueChange={noop}
        applicationId={applicationId}
        resumeUrl={application?.resume_url ?? ''}
        onResumeChange={noop}
        availability={application?.availability ?? {}}
        onAvailabilityChange={noop}
        submissionUrl={submission?.submission_url ?? ''}
        onSubmissionChange={noop}
        disabled
      />

      {template?.instructions && (
        <MarkdownContent className="text-text-muted mt-6 text-sm leading-relaxed">
          {template.instructions}
        </MarkdownContent>
      )}
    </div>
  )
}
