'use client'
import Link from 'next/link'
import { ArrowLeft, Maximize2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { PageContainer } from '@/components/PageContainer'
import type { Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useQuestions } from '@/lib/queries/questions'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { ResponseField } from '../../components/ResponseField'

export function ApplicationDetailClient({
  applicationId,
  cycleId,
  role,
  applicantNuid,
}: {
  applicationId: string
  cycleId: string
  role: Role
  applicantNuid: string
}) {
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)

  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/reviewer/applications"
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Back to Applications
          </Link>
          <Link
            href={`/reviewer/my-reviews/${applicationId}`}
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
          >
            <Maximize2 className="h-3 w-3" />
            Review Applicant
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <Avatar name={applicant?.full_name ?? ''} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-text-default text-2xl font-semibold">
                {applicant?.full_name ?? 'Applicant'}
              </h1>
              <span
                className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[role]}`}
              >
                {ROLE_LABEL[role]}
              </span>
            </div>
            <p className="text-text-muted mt-1 text-sm">{applicant?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q) => (
            <ResponseField
              key={q.id}
              question={q}
              answer={answers.find((a) => a.question_id === q.id)}
              applicable
            />
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
