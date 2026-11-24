'use client'

import { scoreOutOf } from '@/lib/scores'
import { useIsChief } from '@/lib/queries/cycle-staff'
import { useMemo } from 'react'
import { useRoleLookup } from '@/lib/queries/roles'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_L, PAGE_R, PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'
import { CandidateTags } from '@/components/CandidateTags'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useApplication, useApplications } from '@/lib/queries/applications'
import { useQuestions } from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import { REVIEW_STATE_BADGE } from '../../constants'
import { ReviewForm } from './ReviewForm'
import { ResponseField } from '@/app/(portal)/reviewer/applications/components/ResponseField'
import { Fact, Facts } from '@/components/ui/facts'

export function ReviewClient({
  applicationId,
  cycleId,
  role,
  applicantNuid,
}: {
  applicationId: string
  cycleId: string
  role: string
  applicantNuid: string
}) {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: reviewQuestions = [], isLoading: reviewQuestionsLoading } =
    useReviewQuestions(cycleId, role)
  const { data: template } = useApplicationTemplate(cycleId, role)
  const { data: reviews = [], isLoading: reviewsLoading } =
    useWrittenReviews(applicationId)
  const { data: application } = useApplication(applicationId)

  const { data: assignedApplications = [], isFetched: queueFetched } =
    useApplications({ assigned_to: currentUser?.nuid ?? '' }, undefined, {
      enabled: !!currentUser?.nuid,
    })
  // All roles, in the same order the queue page groups them.
  const { roleIds, roleLabel, roleChipClass } = useRoleLookup()
  const orderedQueue = useMemo(
    () =>
      roleIds.flatMap((r) =>
        assignedApplications.filter((a) => a.role_id === r)
      ),
    [assignedApplications, roleIds]
  )
  const queuePosition = orderedQueue.findIndex((a) => a.id === applicationId)
  const previousApplicationId =
    queuePosition > 0 ? orderedQueue[queuePosition - 1].id : null
  const nextApplicationId =
    queuePosition >= 0 && queuePosition < orderedQueue.length - 1
      ? orderedQueue[queuePosition + 1].id
      : null

  const isChief = useIsChief()

  const own = reviews.find((r) => r.reviewer_nuid === currentUser?.nuid)
  const others = reviews.filter((r) => r.reviewer_nuid !== currentUser?.nuid)

  // Applicant answers keyed by question id, for the read-only left panel.
  const answersByQuestionId = useMemo(
    () => new Map(answers.map((a) => [a.question_id, a])),
    [answers]
  )

  const submitted = !!own?.submitted_at

  if (
    currentUser &&
    queueFetched &&
    !isChief &&
    !assignedApplications.some((a) => a.id === applicationId)
  ) {
    return (
      <div className={cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)}>
        <Breadcrumbs
          items={[
            { label: 'My reviews', href: '/reviewer/my-work?phase=reviews' },
            { label: 'Not assigned' },
          ]}
        />
        <EmptyState
          title="You're not assigned to this review"
          description="Only the people assigned to it can open this page. You can still see this applicant from Applicants."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {/* Top bar */}
      <div className={cn('bg-white pb-6', PAGE_X, PAGE_TOP)}>
        <PageHeader
          back={
            <Breadcrumbs
              items={[
                isChief
                  ? {
                      label: 'Reviews & progress',
                      href: '/reviewer/cycle/reviewing?view=mine',
                    }
                  : {
                      label: 'My reviews',
                      href: '/reviewer/my-work?phase=reviews',
                    },
                { label: applicant?.full_name ?? 'Applicant' },
              ]}
            />
          }
          title={applicant?.full_name ?? 'Applicant'}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Badge className={`w-fit shrink-0 ${roleChipClass(role)}`}>
                {roleLabel(role)}
              </Badge>
              <CandidateTags
                compact
                applicationId={applicationId}
                cycleId={cycleId}
                tagIds={application?.tag_ids}
              />
              {(applicant?.graduation_year || applicant?.major) && (
                <Facts className="text-text-muted text-sm">
                  {applicant?.graduation_year && (
                    <Fact icon={GraduationCap}>
                      Class of {applicant.graduation_year}
                    </Fact>
                  )}
                  {applicant?.major && (
                    <Fact icon={BookOpen}>{applicant.major}</Fact>
                  )}
                </Facts>
              )}
              {applicant?.returner && <ReturnerBadge showLabel />}
            </span>
          }
          actions={
            <>
              {queuePosition >= 0 && (
                <span className="font-display text-text-subtle mr-3 text-[11px] tracking-wider uppercase">
                  Review {queuePosition + 1} of {orderedQueue.length}
                </span>
              )}
              {submitted && (
                <Badge className={REVIEW_STATE_BADGE.submitted}>
                  <CheckCircle2 size={12} />
                  Review submitted
                </Badge>
              )}
              {previousApplicationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/reviewer/my-reviews/${previousApplicationId}`)
                  }
                >
                  <ChevronLeft data-icon="inline-start" size={14} />
                  Previous<span className="hidden sm:inline"> application</span>
                </Button>
              )}
              {nextApplicationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/reviewer/my-reviews/${nextApplicationId}`)
                  }
                >
                  Next<span className="hidden sm:inline"> application</span>
                  <ArrowRight data-icon="inline-end" size={14} />
                </Button>
              )}
            </>
          }
        />
      </div>

      <ResizableSplit
        storageKey="review-split"
        className="min-h-0 flex-1 lg:overflow-hidden"
        left={
          <>
            {/* Application */}
            <div
              className={cn(
                'border-b border-gray-200 py-6 lg:overflow-y-auto lg:border-b-0',
                PAGE_L,
                'pr-6 sm:pr-8'
              )}
            >
              <SectionLabel className="mb-4">Application</SectionLabel>
              <div className="space-y-4">
                {questions.map((q) => (
                  <ResponseField
                    key={q.id}
                    question={q}
                    answer={answersByQuestionId.get(q.id)}
                    applicable={true}
                  />
                ))}
              </div>
            </div>
          </>
        }
        right={
          <>
            {/* Review */}
            <div className="lg:flex lg:min-h-0 lg:flex-col">
              {reviewsLoading || reviewQuestionsLoading ? (
                <div
                  className={cn(
                    'flex flex-col gap-4 py-6 pl-6 sm:pl-8',
                    PAGE_R
                  )}
                >
                  <span className="h-3 w-24 animate-pulse bg-gray-100" />
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="h-40 animate-pulse border border-gray-100 bg-gray-50"
                    />
                  ))}
                </div>
              ) : (
                <ReviewForm
                  key={applicationId}
                  applicationId={applicationId}
                  reviewQuestions={reviewQuestions}
                  own={own}
                  reviewClosesAt={template?.review_closes_at}
                >
                  {others.length > 0 && (
                    <div>
                      <SectionLabel as="h3" className="mt-2 mb-3">
                        Other reviews
                      </SectionLabel>
                      <div className="flex flex-col gap-3">
                        {others.map((r) => (
                          <Card key={r.id}>
                            <span className="text-text-muted text-xs">
                              Reviewer {r.reviewer_name || r.reviewer_nuid}
                            </span>
                            <div className="mt-2 flex flex-col gap-2">
                              {reviewQuestions.map((q) => {
                                const a = r.answers.find(
                                  (ans) => ans.review_question_id === q.id
                                )
                                if (!a) return null
                                const display =
                                  a.score != null
                                    ? scoreOutOf(a.score, q)
                                    : a.answer_options?.length
                                      ? a.answer_options.join(', ')
                                      : a.answer_text
                                if (!display) return null
                                return (
                                  <div key={q.id}>
                                    <p className="text-text-muted text-xs font-medium">
                                      {q.question_text}
                                    </p>
                                    <p className="text-text-default text-sm whitespace-pre-wrap">
                                      {display}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </ReviewForm>
              )}
            </div>
          </>
        }
      />
    </div>
  )
}
