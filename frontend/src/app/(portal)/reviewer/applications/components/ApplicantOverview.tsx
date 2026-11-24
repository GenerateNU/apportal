'use client'

import { scoreOutOf, averageLabel } from '@/lib/scores'
import { useIsChief } from '@/lib/queries/cycle-staff'
import Link from 'next/link'
import { ExternalLink, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import { CandidateTags } from '@/components/CandidateTags'
import type { ApplicationStage } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useInterviewComments } from '@/lib/queries/interview-comments'
import { useInterview } from '@/lib/queries/interviews'
import { useWorkflow } from '@/lib/queries/workflow'
import { useQuestions } from '@/lib/queries/questions'
import { useRecordingReviews } from '@/lib/queries/recording-reviews'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useChiefs, useCurrentUser, useLeads } from '@/lib/queries/users'
import { useApplications, useApplication } from '@/lib/queries/applications'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import { formatDate } from '@/lib/utils'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { ChallengeCard } from './ChallengeCard'
import { ORDERED_STAGES, stageBadge, stageLabel } from './constants'
import { ResponseField } from './ResponseField'
import { ReviewTeam } from './ReviewTeam'
import { useRoleLookup } from '@/lib/queries/roles'
import { Fact } from '@/components/ui/facts'

const SECTION_CLASS = 'flex flex-col gap-3 p-5'

// Mean of a review's scored answers, on the 0-10 scale score questions use.
// Null when nothing in it was scored.
function scoreAverage(answers: { score?: number }[]) {
  const scores = answers
    .map((a) => a.score)
    .filter((s): s is number => s != null)
  if (scores.length === 0) return null
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

// A single "everything about this applicant" view — application answers,
// lead reviews, the interview write-up/rating, recording reviews, and the
// open comment thread — so a reviewer doesn't have to hop between separate
// pages to get the full picture. Deliberately excludes chief review data,
// which stays on its own page. Shared between the applications table's
// slide-over drawer and the full applicant page; each data source is fetched
// fresh on mount here (a single applicant's worth, not a per-row batch), the
// same way the interview/review detail pages already do.
const reached = (stage: ApplicationStage | undefined, from: ApplicationStage) =>
  !!stage &&
  ORDERED_STAGES.indexOf(stage) >= ORDERED_STAGES.indexOf(from) &&
  stage !== 'rejected' &&
  stage !== 'withdrawn'

export function sectionsReached({
  stage,
  reviewsUnlocked,
  hasReviews,
  hasInterview,
}: {
  stage?: ApplicationStage
  reviewsUnlocked: boolean
  hasReviews: boolean
  hasInterview: boolean
}) {
  return {
    reviews: reviewsUnlocked || hasReviews || reached(stage, 'lead_review'),
    interview: hasInterview || reached(stage, 'interview'),
  }
}

export function ApplicantOverview({
  applicationId,
  cycleId,
  role,
  applicantNuid,
  stage,
  hideHeader = false,
}: {
  applicationId: string
  cycleId: string
  role: string
  applicantNuid: string
  stage?: ApplicationStage
  hideHeader?: boolean
}) {
  const { roleLabel, roleChipClass } = useRoleLookup()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: application } = useApplication(applicationId)
  const { data: answers = [], isLoading: answersLoading } =
    useAnswers(applicationId)
  const { data: questions = [], isLoading: questionsLoading } = useQuestions(
    cycleId,
    role
  )
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()

  const nameByNuid = new Map<string, string>()
  for (const u of [...leads, ...chiefs]) nameByNuid.set(u.nuid, u.full_name)

  // Lead reviews: the backend already withholds other reviewers' answers
  // from a plain lead until a chief releases them for this cycle/role, same
  // gating the lead-review page itself relies on.
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: writtenReviews = [], isLoading: writtenReviewsLoading } =
    useWrittenReviews(applicationId)

  const { data: interview, isLoading: interviewLoading } =
    useInterview(applicationId)
  const { data: recordingReviews = [] } = useRecordingReviews(
    interview ? applicationId : ''
  )
  const { data: comments = [] } = useInterviewComments(applicationId)
  const { data: me } = useCurrentUser()
  const { data: myReviewQueue = [] } = useApplications(
    { assigned_to: me?.nuid ?? '' },
    undefined,
    { enabled: !!me?.nuid }
  )
  const isChief = useIsChief()
  const canOpenInterview =
    isChief ||
    !!interview?.interviewers.some((iv) => iv.interviewer_nuid === me?.nuid) ||
    recordingReviews.some((r) => r.reviewer_nuid === me?.nuid)
  const canOpenReview =
    isChief || myReviewQueue.some((a) => a.id === applicationId)
  const { data: workflow } = useWorkflow(isChief ? cycleId : '')
  const { reviews: showReviews, interview: showInterview } = sectionsReached({
    stage,
    reviewsUnlocked:
      !!workflow &&
      (workflow.steps ?? []).find((s) => s.step === 'reviews')?.status !==
        'locked',
    hasReviews: writtenReviews.length > 0,
    hasInterview: !!interview,
  })

  const leadAvg = scoreAverage(writtenReviews.flatMap((r) => r.answers))

  return (
    <div className="flex flex-col gap-6">
      {!hideHeader && (
        <div className="flex items-start gap-4">
          <Avatar name={applicant?.full_name ?? ''} size="lg" />
          <div className="min-w-0">
            <PageHeader
              crumbSpace={false}
              title={applicant?.full_name ?? 'Applicant'}
              subtitle={applicant?.email}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className={roleChipClass(role)}>{roleLabel(role)}</Badge>
              {stage && (
                <Badge className={stageBadge[stage]}>{stageLabel[stage]}</Badge>
              )}
              {interview?.rating && (
                <Badge
                  className={`${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
                >
                  {RATING_LABEL[interview.rating]}
                </Badge>
              )}
              {applicant?.returner && <ReturnerBadge showLabel />}
              <CandidateTags
                applicationId={applicationId}
                cycleId={cycleId}
                tagIds={application?.tag_ids}
              />
            </div>
          </div>
        </div>
      )}

      {/* Directly under the name: for a draft call this is what people open
          the drawer to read, and the write-ups run long enough that putting it
          after the application answers means scrolling past everything else. */}
      {showInterview && (
        <Card className={SECTION_CLASS}>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Interview review</SectionLabel>
            {canOpenInterview && (
              <Link
                href={`/reviewer/my-interviews/${applicationId}`}
                className="text-ink text-xs hover:underline"
              >
                Open interview page →
              </Link>
            )}
          </div>
          {interviewLoading ? (
            <LoadingText />
          ) : !interview ? (
            <p className="text-text-faint text-sm">Not yet interviewed.</p>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {interview.rating ? (
                  <Badge
                    className={`${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
                  >
                    {RATING_LABEL[interview.rating]}
                  </Badge>
                ) : (
                  <span className="text-text-faint text-xs">Not rated yet</span>
                )}
                {interview.interviewers.length > 0 && (
                  <span className="text-text-muted">
                    Interviewed by{' '}
                    <span className="text-text-default font-medium">
                      {interview.interviewers
                        .map(
                          (iv) =>
                            iv.interviewer_name ??
                            nameByNuid.get(iv.interviewer_nuid) ??
                            iv.interviewer_nuid
                        )
                        .join(', ')}
                    </span>
                  </span>
                )}
              </div>

              {/* Spelled out as labelled rows with the URL visible: which share
                it is — Zoom, Drive, a doc — decides whether it's worth opening
                before the draft call. */}
              <dl className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2">
                <dt className="text-text-muted text-xs font-medium">
                  Recording
                </dt>
                <dd className="min-w-0">
                  {interview.recording_url ? (
                    <a
                      href={interview.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink inline-flex max-w-full items-center gap-1 hover:underline"
                    >
                      <span className="truncate">
                        {interview.recording_url}
                      </span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-text-faint">Not provided</span>
                  )}
                </dd>
                <dt className="text-text-muted text-xs font-medium">Notes</dt>
                <dd className="min-w-0">
                  {interview.notes_url ? (
                    <a
                      href={interview.notes_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink inline-flex max-w-full items-center gap-1 hover:underline"
                    >
                      <span className="truncate">{interview.notes_url}</span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-text-faint">Not provided</span>
                  )}
                </dd>
              </dl>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                      Write-up
                    </span>
                    <Fact icon={Users} className="text-text-muted">
                      {interview.interviewers
                        .map(
                          (iv) =>
                            iv.interviewer_name ??
                            nameByNuid.get(iv.interviewer_nuid) ??
                            iv.interviewer_nuid
                        )
                        .join(', ') || 'No interviewers'}
                    </Fact>
                  </span>
                  {interview.submitted_at ? (
                    <Badge size="sm" className="bg-emerald-50 text-emerald-700">
                      Submitted {formatDate(interview.submitted_at)}
                    </Badge>
                  ) : (
                    <Badge size="sm">Not submitted</Badge>
                  )}
                </div>
                <p className="text-text-default mt-1 whitespace-pre-wrap">
                  {interview.writeup || (
                    <span className="text-text-faint">No write-up yet.</span>
                  )}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-text-muted text-xs font-medium">
                  Recording reviews ({recordingReviews.length})
                </p>
                {recordingReviews.length === 0 ? (
                  <p className="text-text-faint mt-1">No reviews yet.</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-3">
                    {recordingReviews.map((r) => (
                      <Card key={r.id} variant="flat">
                        <span className="text-text-muted text-xs">
                          {r.reviewer_name ||
                            nameByNuid.get(r.reviewer_nuid) ||
                            r.reviewer_nuid}
                        </span>
                        <p className="text-text-default mt-2 whitespace-pre-wrap">
                          {r.writeup ?? (
                            <span className="text-text-faint">
                              Not submitted yet.
                            </span>
                          )}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <ChallengeCard
        applicantNuid={applicantNuid}
        applicationId={applicationId}
        cycleId={cycleId}
        role={role}
      />

      <Card className={SECTION_CLASS}>
        <SectionLabel>Application</SectionLabel>
        {answersLoading || questionsLoading ? (
          <LoadingText />
        ) : (
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
        )}
      </Card>

      {showReviews && (
        <Card className={SECTION_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SectionLabel>Lead reviews</SectionLabel>
              {leadAvg != null && (
                <Badge className="text-text-default">
                  {averageLabel(leadAvg, reviewQuestions)}
                </Badge>
              )}
            </div>
            {canOpenReview && !isChief && (
              <Link
                href={`/reviewer/my-reviews/${applicationId}`}
                className="text-ink text-xs hover:underline"
              >
                Open review page →
              </Link>
            )}
          </div>
          {isChief && (
            <ReviewTeam
              applicationId={applicationId}
              applicantName={applicant?.full_name ?? 'this applicant'}
              me={me?.nuid}
              isChief={isChief}
              reviews={writtenReviews}
              nameByNuid={nameByNuid}
            />
          )}
          {writtenReviewsLoading ? (
            <LoadingText />
          ) : writtenReviews.length === 0 ? (
            <p className="text-text-faint text-sm">No lead reviews yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {writtenReviews.map((r) => {
                const avg = scoreAverage(r.answers)
                return (
                  <Card key={r.id} variant="flat">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted text-xs">
                        {r.reviewer_name || r.reviewer_nuid}
                      </span>
                      {avg != null && (
                        <Badge className="text-text-default">
                          {averageLabel(avg, reviewQuestions)}
                        </Badge>
                      )}
                    </div>
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
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Card className={SECTION_CLASS}>
        <SectionLabel>Comments</SectionLabel>
        {comments.length === 0 ? (
          <p className="text-text-faint text-sm">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((c) => (
              <Card key={c.id} variant="flat">
                <p className="text-text-muted text-xs">
                  {c.author_name || c.author_nuid}
                </p>
                <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                  {c.body}
                </p>
                <p className="text-text-faint mt-1.5 text-xs">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
