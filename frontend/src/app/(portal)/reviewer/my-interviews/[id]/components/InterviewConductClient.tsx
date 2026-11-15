'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRoleLookup } from '@/lib/queries/roles'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  Loader2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_L, PAGE_R, PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { PanelHeading } from '@/components/ui/panel-heading'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import type { InterviewComment } from '@/lib/api/types'
import { ChallengeCard } from '@/app/(portal)/reviewer/applications/components/ChallengeCard'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { CandidateTags } from '@/components/CandidateTags'
import { useApplication, useApplications } from '@/lib/queries/applications'
import { useChallenges } from '@/lib/queries/challenges'
import {
  useCreateInterviewComment,
  useInterviewComments,
  useUpdateInterviewComment,
} from '@/lib/queries/interview-comments'
import { interviewSubmitted, useInterview } from '@/lib/queries/interviews'
import { useQuestions } from '@/lib/queries/questions'
import { useRecordingReviews } from '@/lib/queries/recording-reviews'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser, useReviewerNames } from '@/lib/queries/users'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import { cn } from '@/lib/utils'
import { ResponseField } from '@/app/(portal)/reviewer/applications/components/ResponseField'
import { InterviewScriptContent } from '@/app/(portal)/reviewer/interview-script/components/InterviewScriptContent'
import { InterviewSummary } from './InterviewSummary'
import { InterviewWriteupForm } from './InterviewWriteupForm'
import { RecordingReviewThread } from './RecordingReviewThread'

const COMMENT_TEXTAREA_CLASS =
  'focus:border-ink text-text-default placeholder:text-text-subtle w-full border border-gray-300 bg-white p-3 text-sm focus:outline-none'

// Which list page linked into this interview — carried through the `from`
// query param so the breadcrumb (and paging via Previous/Next) returns
// wherever the reviewer actually came from, instead of always assuming My
// Interviews.
const BACK_LINK: Record<string, { href: string; label: string }> = {
  'interview-ratings': {
    href: '/reviewer/interview-ratings',
    label: 'Interview ratings',
  },
}
const DEFAULT_BACK_LINK = {
  href: '/reviewer/my-interviews',
  label: 'My interviews',
}

type LeftTab = 'application' | 'challenge' | 'script'
type RightTab = 'interview' | 'recordings' | 'comments'

export function InterviewConductClient({
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
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? ''
  const backLink = BACK_LINK[from] ?? DEFAULT_BACK_LINK
  const queueQuery = from ? `?from=${encodeURIComponent(from)}` : ''
  const { data: currentUser } = useCurrentUser()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: application } = useApplication(applicationId)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const hasChallenge = challenges.length > 0
  // What other leads said about this applicant's written application during
  // lead review — so an interviewer doesn't have to separately open the
  // lead-review page to see it. The backend already withholds other
  // reviewers' answers from a plain lead until a chief releases them for
  // this cycle/role, same as the lead-review page itself.
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: writtenReviews = [] } = useWrittenReviews(applicationId)
  const otherWrittenReviews = writtenReviews.filter(
    (r) => r.reviewer_nuid !== currentUser?.nuid
  )
  const nameByNuid = useReviewerNames()
  const nameFor = useCallback(
    (nuid: string) => nameByNuid.get(nuid) ?? nuid,
    [nameByNuid]
  )
  const { data: interview, isLoading: interviewLoading } =
    useInterview(applicationId)
  const interviewers = interview?.interviewers ?? []
  const interviewerNames = interviewers
    .map((iv) => iv.interviewer_name ?? nameFor(iv.interviewer_nuid))
    .join(', ')
  const { data: recordingReviews = [], isFetched: recordingFetched } =
    useRecordingReviews(interview ? applicationId : '')

  const isInterviewer = interviewers.some(
    (iv) => iv.interviewer_nuid === currentUser?.nuid
  )
  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )
  const writeupSubmitted = !!interview?.submitted_at
  const [editingWriteup, setEditingWriteup] = useState(false)
  const canReview =
    !!currentUser &&
    recordingReviews.some((r) => r.reviewer_nuid === currentUser.nuid)
  const writeupDone = interviewSubmitted(interview)

  const { data: assignedApplications = [] } = useApplications(
    { interviewer_nuid: currentUser?.nuid ?? '' },
    undefined,
    { enabled: !!currentUser?.nuid }
  )
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

  // Applicant answers keyed by question id, for the read-only left panel.
  const answersByQuestionId = useMemo(
    () => new Map(answers.map((a) => [a.question_id, a])),
    [answers]
  )

  // Open calibration discussion — any reviewer can post, unlike the
  // interviewer write-up and recording reviews.
  const { data: discussionComments = [] } = useInterviewComments(applicationId)
  const createComment = useCreateInterviewComment()
  const updateComment = useUpdateInterviewComment()
  const [newComment, setNewComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  async function postComment() {
    const body = newComment.trim()
    if (!body) return
    await createComment.mutateAsync({ applicationId, body: { body } })
    setNewComment('')
  }

  function startEditingComment(comment: InterviewComment) {
    setEditingCommentId(comment.id)
    setEditingBody(comment.body)
  }

  async function saveEditedComment() {
    const body = editingBody.trim()
    if (!editingCommentId || !body) return
    await updateComment.mutateAsync({
      applicationId,
      commentId: editingCommentId,
      body: { body },
    })
    setEditingCommentId(null)
  }

  const leftTabs: { id: LeftTab; label: string }[] = [
    { id: 'application', label: 'Application' },
    ...(hasChallenge ? [{ id: 'challenge' as const, label: 'Challenge' }] : []),
    { id: 'script', label: 'Script' },
  ]
  const [pickedLeft, setPickedLeft] = useState<LeftTab | null>(null)
  const leftTab: LeftTab =
    pickedLeft && leftTabs.some((t) => t.id === pickedLeft)
      ? pickedLeft
      : isInterviewer && !writeupSubmitted
        ? 'script'
        : 'application'

  const rightTabs: { id: RightTab; label: string; count?: number }[] = [
    { id: 'interview', label: 'Interview' },
    ...(canReview || recordingReviews.length > 0
      ? [
          {
            id: 'recordings' as const,
            label: 'Recording reviews',
            count: recordingReviews.filter((r) => r.writeup_submitted_at)
              .length,
          },
        ]
      : []),
    { id: 'comments', label: 'Comments', count: discussionComments.length },
  ]
  const [pickedRight, setPickedRight] = useState<RightTab | null>(null)
  const rightTab: RightTab =
    pickedRight && rightTabs.some((t) => t.id === pickedRight)
      ? pickedRight
      : canReview && !isInterviewer
        ? 'recordings'
        : 'interview'

  const crumbs =
    !isChief && isInterviewer
      ? [
          { label: 'My work', href: '/reviewer/my-work' },
          { label: 'Interviews', href: '/reviewer/my-work?phase=interviews' },
        ]
      : !isChief && canReview
        ? [
            { label: 'My work', href: '/reviewer/my-work' },
            {
              label: 'Interview reviews',
              href: '/reviewer/my-work?phase=interviewReviews',
            },
          ]
        : [backLink]

  const applicantFacts = [
    applicant?.graduation_year && `Class of ${applicant.graduation_year}`,
    applicant?.major,
  ].filter(Boolean) as string[]

  const scrollPane = cn(
    'py-6 pl-6 sm:pl-8 lg:flex-1 lg:overflow-y-auto',
    PAGE_R
  )
  const paneClass = (tab: RightTab) =>
    cn(rightTab === tab ? 'flex' : 'hidden', 'flex-col lg:min-h-0 lg:flex-1')

  const assignmentKnown =
    !!currentUser && !interviewLoading && (!interview || recordingFetched)
  if (assignmentKnown && !isChief && !isInterviewer && !canReview) {
    return (
      <div className={cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)}>
        <Breadcrumbs
          items={[
            { label: 'My work', href: '/reviewer/my-work' },
            { label: 'Not assigned' },
          ]}
        />
        <EmptyState
          title="You're not assigned to this interview"
          description="Only the people assigned to it can open this page. You can still see this applicant from Applicants."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <div className={cn('bg-white pb-6', PAGE_X, PAGE_TOP)}>
        <PageHeader
          back={
            <Breadcrumbs
              items={[
                ...crumbs,
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
              {applicantFacts.length > 0 && (
                <span className="text-text-muted text-sm">
                  {applicantFacts.join(' · ')}
                </span>
              )}
              {applicant?.returner && <ReturnerBadge showLabel />}
            </span>
          }
          actions={
            <>
              {queuePosition >= 0 && (
                <span className="font-display text-text-subtle mr-3 text-[11px] tracking-wider uppercase">
                  Interview {queuePosition + 1} of {orderedQueue.length}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() =>
                  document
                    .getElementById('interview-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                <ArrowDown data-icon="inline-start" size={14} />
                Write-up
              </Button>
              {previousApplicationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/reviewer/my-interviews/${previousApplicationId}${queueQuery}`
                    )
                  }
                >
                  <ChevronLeft data-icon="inline-start" size={14} />
                  Previous
                </Button>
              )}
              {nextApplicationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/reviewer/my-interviews/${nextApplicationId}${queueQuery}`
                    )
                  }
                >
                  Next
                  <ArrowRight data-icon="inline-end" size={14} />
                </Button>
              )}
            </>
          }
        />
      </div>

      <ResizableSplit
        storageKey="interview-split"
        className="min-h-0 flex-1 lg:overflow-hidden"
        left={
          <div className="border-b border-gray-200 lg:overflow-y-auto lg:border-b-0">
            <div
              className={cn(
                'border-b border-gray-200 bg-white pt-6 pb-4 lg:sticky lg:top-0 lg:z-10',
                PAGE_L,
                'pr-6 sm:pr-8'
              )}
            >
              <SegmentedTabs
                tabs={leftTabs}
                value={leftTab}
                onChange={setPickedLeft}
              />
            </div>
            <div className={cn('py-6', PAGE_L, 'pr-6 sm:pr-8')}>
              {leftTab === 'application' && (
                <div className="flex flex-col gap-10">
                  <section className="flex flex-col gap-4">
                    <PanelHeading>Application</PanelHeading>
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
                  </section>

                  {otherWrittenReviews.length > 0 && (
                    <section className="flex flex-col gap-4">
                      <PanelHeading>Lead reviews</PanelHeading>
                      {otherWrittenReviews.map((r) => (
                        <div
                          key={r.id}
                          className="border border-gray-200 bg-gray-50 p-4"
                        >
                          <span className="text-ink text-sm font-semibold">
                            {r.reviewer_name || r.reviewer_nuid}
                          </span>
                          <div className="mt-2 flex flex-col gap-2">
                            {reviewQuestions.map((q) => {
                              const a = r.answers.find(
                                (ans) => ans.review_question_id === q.id
                              )
                              if (!a) return null
                              const display =
                                a.score != null
                                  ? `${a.score}/10`
                                  : a.answer_options?.length
                                    ? a.answer_options.join(', ')
                                    : a.answer_text
                              if (!display) return null
                              return (
                                <div key={q.id}>
                                  <p className="text-text-muted text-xs font-medium">
                                    {q.question_text}
                                  </p>
                                  <p className="text-text-default text-sm wrap-anywhere whitespace-pre-wrap">
                                    {display}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </div>
              )}

              {leftTab === 'challenge' && (
                <ChallengeCard
                  applicantNuid={applicantNuid}
                  applicationId={applicationId}
                  cycleId={cycleId}
                  role={role}
                  bare
                />
              )}

              {leftTab === 'script' && (
                <div className="flex flex-col gap-3">
                  <InterviewScriptContent
                    cycleId={cycleId}
                    role={role}
                    checklistKey={applicationId}
                  />
                </div>
              )}
            </div>
          </div>
        }
        right={
          <div
            id="interview-panel"
            className="flex scroll-mt-4 flex-col lg:min-h-0"
          >
            <div
              className={cn(
                'border-b border-gray-200 bg-white pt-6 pb-4 pl-6 sm:pl-8',
                PAGE_R
              )}
            >
              <SegmentedTabs
                tabs={rightTabs}
                value={rightTab}
                onChange={setPickedRight}
              />
            </div>

            <div className={paneClass('interview')}>
              {interviewLoading ? (
                <div className={cn('flex flex-col gap-4', scrollPane)}>
                  <span className="h-3 w-24 animate-pulse bg-gray-100" />
                  <div className="h-40 animate-pulse border border-gray-100 bg-gray-50" />
                </div>
              ) : isInterviewer &&
                interview &&
                (!writeupSubmitted || editingWriteup) ? (
                <InterviewWriteupForm
                  key={interview.id}
                  applicationId={applicationId}
                  interview={interview}
                  interviewerNames={interviewerNames}
                  onDone={() => setEditingWriteup(false)}
                />
              ) : (
                <div className={scrollPane}>
                  <InterviewSummary
                    applicationId={applicationId}
                    interview={interview}
                    interviewerNames={interviewerNames}
                    isInterviewer={isInterviewer}
                    isChief={isChief}
                    onEdit={
                      isInterviewer && writeupSubmitted
                        ? () => setEditingWriteup(true)
                        : undefined
                    }
                  />
                </div>
              )}
            </div>

            {rightTabs.some((t) => t.id === 'recordings') && (
              <div className={paneClass('recordings')}>
                {!writeupDone ? (
                  <div className={scrollPane}>
                    <EmptyState
                      size="sm"
                      title="Waiting on the interviewer"
                      description="Waiting for the interview write-up to be submitted before reviews can start."
                    />
                  </div>
                ) : (
                  <div className={scrollPane}>
                    <RecordingReviewThread
                      key={
                        recordingReviews.find(
                          (r) => r.reviewer_nuid === currentUser?.nuid
                        )?.id ?? 'none'
                      }
                      applicationId={applicationId}
                      reviews={recordingReviews}
                      currentNuid={currentUser?.nuid}
                      nameFor={nameFor}
                      recordingUrl={interview?.recording_url}
                    />
                  </div>
                )}
              </div>
            )}

            <div className={paneClass('comments')}>
              <div className={scrollPane}>
                <section className="flex flex-col">
                  <PanelHeading className="mb-2">Comments</PanelHeading>
                  {discussionComments.length === 0 && (
                    <p className="text-text-faint py-3 text-sm">
                      No comments yet.
                    </p>
                  )}
                  {discussionComments.map((c) => {
                    const editing = editingCommentId === c.id
                    const edited = c.updated_at !== c.created_at
                    const isOwn = c.author_nuid === currentUser?.nuid
                    return (
                      <div key={c.id} className="border-b border-gray-200 py-3">
                        {editing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              rows={3}
                              autoFocus
                              aria-label="Edit comment"
                              className={COMMENT_TEXTAREA_CLASS}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={saveEditedComment}
                                disabled={
                                  updateComment.isPending || !editingBody.trim()
                                }
                              >
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 wrap-anywhere">
                              <p className="text-text-muted text-xs">
                                {c.author_name || c.author_nuid}
                                <span className="text-text-faint">
                                  {' · '}
                                  {new Date(c.created_at).toLocaleString()}
                                  {edited && ' · edited'}
                                </span>
                              </p>
                              <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                                {c.body}
                              </p>
                            </div>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => startEditingComment(c)}
                                className="text-text-faint hover:text-text-muted -m-2 shrink-0 p-2"
                                aria-label="Edit comment"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="mt-4 flex flex-col gap-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment on this applicant…"
                      aria-label="New comment"
                      rows={3}
                      className={COMMENT_TEXTAREA_CLASS}
                    />
                    <Button
                      className="self-start"
                      onClick={postComment}
                      disabled={createComment.isPending || !newComment.trim()}
                    >
                      {createComment.isPending ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Posting…
                        </>
                      ) : (
                        'Post comment'
                      )}
                    </Button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
