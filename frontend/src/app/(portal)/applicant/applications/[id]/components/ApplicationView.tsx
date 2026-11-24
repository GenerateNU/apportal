'use client'

import { useMemo } from 'react'
import { TemplateNote } from '../../components/TemplateNote'
import { Lock } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import {
  ApplicantPage,
  useCycleCrumb,
  useOriginCrumb,
} from '../../components/ApplicantPage'
import { PageHeader } from '@/components/ui/page-header'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useApplication } from '@/lib/queries/applications'
import { useAnswers } from '@/lib/queries/answers'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { useSubmission } from '@/lib/queries/submissions'
import { ApplicationFields } from '../../components/ApplicationFields'
import type { AnswerValue } from '../../components/QuestionField'
import { useRoleLookup } from '@/lib/queries/roles'

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
  role: string
}) {
  const { roleLabel } = useRoleLookup()
  const cycleCrumb = useCycleCrumb(cycleId, cycleName)
  const origin = useOriginCrumb()
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

  return (
    <ApplicantPage>
      <PageHeader
        className="mb-6"
        back={
          <Breadcrumbs
            items={[origin, ...cycleCrumb, { label: roleLabel(role) }]}
          />
        }
        title={roleLabel(role)}
        subtitle={cycleName}
      />

      <div>
        <div className="border-border bg-muted/40 text-text-muted mb-6 flex items-center gap-2 border px-4 py-3 text-sm">
          <Lock size={14} className="shrink-0" />
          You&apos;ve submitted this application. It can no longer be edited.
        </div>

        {template?.description && (
          <TemplateNote
            label="About this role"
            className="mb-6"
            expandable={false}
          >
            {template.description}
          </TemplateNote>
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
          <TemplateNote
            label="Instructions"
            className="mt-6"
            expandable={false}
          >
            {template.instructions}
          </TemplateNote>
        )}
      </div>
    </ApplicantPage>
  )
}
