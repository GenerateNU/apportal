'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Loader2,
  Lock,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ChallengeMetrics,
  InterviewComment,
  InterviewRating,
  Role,
} from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { useChallengeScore } from '@/lib/queries/challenge-score'
import {
  useCreateInterviewComment,
  useInterviewComments,
  useUpdateInterviewComment,
} from '@/lib/queries/interview-comments'
import {
  useInterviewAssignment,
  useRecordingReviewerAssignments,
} from '@/lib/queries/interview-assignments'
import {
  useInterview,
  useInterviewsByApplicationIdBatches,
  useUpsertInterview,
} from '@/lib/queries/interviews'
import { useQuestions } from '@/lib/queries/questions'
import {
  useRecordingReviews,
  useUpsertRecordingReview,
} from '@/lib/queries/recording-reviews'
import { useSubmission } from '@/lib/queries/submissions'
import {
  useChiefs,
  useCurrentUser,
  useLeads,
  useUser,
} from '@/lib/queries/users'
import { RATING_LABEL, RATING_OPTIONS } from '@/lib/interview-ratings'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import {
  REVIEW_STATE_BADGE,
  REVIEWED_TEXT,
} from '../../../my-reviews/constants'
import { ResponseField } from '@/app/(portal)/reviewer/applications/components/ResponseField'
import { InterviewScriptContent } from '@/app/(portal)/reviewer/interview-script/components/InterviewScriptContent'

const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-base transition-all outline-none focus-visible:ring-3 hover:border-gray-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-none'

// A reviewer's own comment is keyed by nuid on the wire; look their display
// name up on demand rather than threading it through every list response.
function ReviewerName({ nuid }: { nuid: string }) {
  const { data: user } = useUser(nuid)
  return <>{user?.full_name || nuid}</>
}

const CHALLENGE_METRIC_LABEL: { key: keyof ChallengeMetrics; label: string }[] =
  [
    { key: 'throughput', label: 'Throughput' },
    { key: 'gateUtilization', label: 'Gate utilization' },
    { key: 'arrivalSuccess', label: 'Arrival success' },
    { key: 'fairness', label: 'Fairness' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'slaCompliance', label: 'SLA compliance' },
  ]

// The challenge server names each applicant's repo
// f26-challenge-<first>-<last>-<github-username>, but never exposes the
// username or the repo URL anywhere apportal can read it back — so this
// only reconstructs the name portion and links to a filtered org search
// rather than a guaranteed direct repo link.
const CHALLENGE_GITHUB_ORG = 'generate-recruit'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Ordered most- to least-specific: combined first+last, then each name
// alone, so a reviewer can fall back if the combined slug doesn't line up
// with however the applicant's name was split on the challenge server.
function buildChallengeRepoQueries(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []
  const firstSlug = slugify(parts[0])
  const lastSlug = parts.length > 1 ? slugify(parts[parts.length - 1]) : ''
  const queries: string[] = []
  if (firstSlug && lastSlug)
    queries.push(`f26-challenge-${firstSlug}-${lastSlug}`)
  if (lastSlug) queries.push(`f26-challenge-${lastSlug}`)
  if (firstSlug) queries.push(`f26-challenge-${firstSlug}`)
  return queries
}

function challengeRepoSearchUrl(query: string): string {
  return `https://github.com/orgs/${CHALLENGE_GITHUB_ORG}/repositories?q=${encodeURIComponent(query)}`
}

// The applicant's backend/scheduler technical challenge — read from the
// separate challenge server, shown alongside their code submission link so
// the interviewer doesn't have to leave this page to find either.
function ChallengeCard({
  applicantNuid,
  applicationId,
}: {
  applicantNuid: string
  applicationId: string
}) {
  const { data: score } = useChallengeScore(applicantNuid)
  const { data: submission } = useSubmission(applicationId)
  const { data: applicant } = useApplicant(applicantNuid)
  const [showHistory, setShowHistory] = useState(false)

  if (!score && !submission) return null

  const repoQueries = applicant
    ? buildChallengeRepoQueries(applicant.full_name)
    : []

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
        Technical challenge
      </h2>

      {submission && (
        <a
          href={submission.submission_url}
          target="_blank"
          rel="noreferrer"
          className="text-brand-blue inline-flex w-fit items-center gap-1 text-sm hover:underline"
        >
          View code submission
          <ExternalLink size={12} />
        </a>
      )}

      {score ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-text-default text-lg font-semibold">
              {score.overall_score.toFixed(1)}
            </span>
            <span className="text-text-faint text-xs">
              overall score · {score.attempt_count} finished attempt
              {score.attempt_count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {CHALLENGE_METRIC_LABEL.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-text-faint text-xs">{label}</span>
                <span className="text-text-default text-xs font-medium">
                  {score.metrics[key].toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {repoQueries.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <a
                href={challengeRepoSearchUrl(repoQueries[0])}
                target="_blank"
                rel="noreferrer"
                title="Best-effort name match — the challenge server doesn't expose the applicant's exact repo, so this searches the org for repos matching their name."
                className="text-brand-blue inline-flex w-fit items-center gap-1 hover:underline"
              >
                Find challenge repo (best-effort match)
                <ExternalLink size={10} />
              </a>
              {repoQueries.length > 1 && (
                <span className="text-text-faint">
                  · No match?{' '}
                  {repoQueries.slice(1).map((query, i) => (
                    <span key={query}>
                      {i > 0 && ' · '}
                      <a
                        href={challengeRepoSearchUrl(query)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        try {i === 0 ? 'last name only' : 'first name only'}
                      </a>
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}

          {score.attempts.length > 1 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-brand-blue inline-flex w-fit items-center gap-1 text-xs hover:underline"
            >
              {showHistory ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              {showHistory ? 'Hide' : 'View'} previous attempts (
              {score.attempts.length})
            </button>
          )}

          {showHistory && (
            <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2">
              {score.attempts.map((attempt) => (
                <div
                  key={attempt.expedition_id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-text-faint">
                    {new Date(attempt.finished_at).toLocaleDateString()}
                  </span>
                  <span
                    className={
                      attempt.overall_score === score.overall_score
                        ? 'text-brand-blue font-medium'
                        : 'text-text-default font-medium'
                    }
                  >
                    {attempt.overall_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-text-faint text-sm">
          No finished challenge attempt yet.
        </p>
      )}
    </div>
  )
}

export function InterviewConductClient({
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
  const router = useRouter()
  const [scriptOpen, setScriptOpen] = useState(true)
  const { data: currentUser } = useCurrentUser()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: assignment } = useInterviewAssignment(applicationId)
  const { data: reviewerAssignments = [] } =
    useRecordingReviewerAssignments(applicationId)
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()
  const interviewerName = useMemo(() => {
    if (!assignment?.interviewer_nuid) return null
    const match = [...leads, ...chiefs].find(
      (u) => u.nuid === assignment.interviewer_nuid
    )
    return match?.full_name ?? assignment.interviewer_nuid
  }, [assignment, leads, chiefs])
  const { data: interview } = useInterview(applicationId)
  const upsertInterview = useUpsertInterview()
  const { data: recordingReviews = [] } = useRecordingReviews(
    interview?.id ?? ''
  )
  const upsertRecordingReview = useUpsertRecordingReview()

  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )
  const isAssignedInterviewer =
    !!currentUser && assignment?.interviewer_nuid === currentUser.nuid
  const canEditInterview = isChief || isAssignedInterviewer
  const isAssignedReviewer =
    !!currentUser &&
    reviewerAssignments.some((a) => a.lead_nuid === currentUser.nuid)
  const canReview = isChief || isAssignedReviewer

  // The rest of my interview queue, so a "next" button can jump to the next
  // assigned applicant who still needs to be interviewed — same ordering
  // (grouped by role) as the my-interviews list.
  const { data: assignedApplications = [] } = useApplications(
    { interviewer_nuid: currentUser?.nuid ?? '' },
    undefined,
    { enabled: !!currentUser?.nuid }
  )
  const orderedQueue = useMemo(
    () =>
      ROLE_COLUMNS.flatMap((r) =>
        assignedApplications.filter((a) => a.role === r)
      ),
    [assignedApplications]
  )
  const queueIds = useMemo(() => orderedQueue.map((a) => a.id), [orderedQueue])
  const [queueInterviewBatch] = useInterviewsByApplicationIdBatches(
    queueIds.length > 0 ? [queueIds] : []
  )
  const interviewByApplicationId = queueInterviewBatch?.data
  const needsInterviewAt = useMemo(
    () => (i: number) =>
      !interviewByApplicationId?.[orderedQueue[i].id]?.submitted_at,
    [interviewByApplicationId, orderedQueue]
  )
  const nextApplicationId = useMemo(() => {
    const currentIndex = orderedQueue.findIndex((a) => a.id === applicationId)
    if (currentIndex === -1) return null
    for (let i = currentIndex + 1; i < orderedQueue.length; i++) {
      if (needsInterviewAt(i)) return orderedQueue[i].id
    }
    return null
  }, [orderedQueue, needsInterviewAt, applicationId])
  const previousApplicationId = useMemo(() => {
    const currentIndex = orderedQueue.findIndex((a) => a.id === applicationId)
    if (currentIndex === -1) return null
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (needsInterviewAt(i)) return orderedQueue[i].id
    }
    return null
  }, [orderedQueue, needsInterviewAt, applicationId])

  // Applicant answers keyed by question id, for the read-only left panel.
  const answersByQuestionId = useMemo(
    () => new Map(answers.map((a) => [a.question_id, a])),
    [answers]
  )

  const [recordingUrl, setRecordingUrl] = useState('')
  const [notesUrl, setNotesUrl] = useState('')
  const [comments, setComments] = useState('')
  const [rating, setRating] = useState<InterviewRating | ''>('')
  const [seeded, setSeeded] = useState(false)
  const [savedInterview, setSavedInterview] = useState(false)

  if (!seeded && interview) {
    setRecordingUrl(interview.recording_url ?? '')
    setNotesUrl(interview.notes_url ?? '')
    setComments(interview.comments ?? '')
    setRating(interview.rating ?? '')
    setSeeded(true)
  }

  const interviewSubmitted = !!interview?.submitted_at
  const missingInterviewRequired = !comments.trim() || !rating

  async function saveInterview(submit: boolean) {
    setSavedInterview(false)
    await upsertInterview.mutateAsync({
      applicationId,
      body: {
        recording_url: recordingUrl || undefined,
        notes_url: notesUrl || undefined,
        comments: comments || undefined,
        rating: rating || undefined,
        submit,
      },
    })
    setSavedInterview(true)
  }

  const ownReview = recordingReviews.find(
    (r) => r.reviewer_nuid === currentUser?.nuid
  )
  const otherReviews = recordingReviews.filter(
    (r) => r.reviewer_nuid !== currentUser?.nuid
  )

  const [reviewComment, setReviewComment] = useState('')
  const [reviewSeeded, setReviewSeeded] = useState(false)
  const [savedReview, setSavedReview] = useState(false)
  if (!reviewSeeded && ownReview) {
    setReviewComment(ownReview.comments ?? '')
    setReviewSeeded(true)
  }
  const reviewSubmitted = !!ownReview?.submitted_at

  async function saveReview(submit: boolean) {
    if (!interview) return
    setSavedReview(false)
    await upsertRecordingReview.mutateAsync({
      interviewId: interview.id,
      body: { comments: reviewComment || undefined, submit },
    })
    setSavedReview(true)
  }

  // Open calibration discussion — any reviewer can post, unlike the
  // interviewer write-up and recording reviews above.
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

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/reviewer/my-interviews"
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Back to My interviews
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <h1 className="text-text-default text-lg font-semibold">
              {applicant?.full_name ?? 'Applicant'}
            </h1>
            <span
              className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[role]}`}
            >
              {ROLE_LABEL[role]}
            </span>
            {interviewerName && (
              <span className="text-text-subtle text-sm">
                Interviewer: {interviewerName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {interviewSubmitted && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE.submitted}`}
            >
              <CheckCircle2 size={12} />
              Interviewed
            </span>
          )}
          {previousApplicationId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/reviewer/my-interviews/${previousApplicationId}`)
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
                router.push(`/reviewer/my-interviews/${nextApplicationId}`)
              }
            >
              Next
              <ArrowRight data-icon="inline-end" size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Split: application (left) · interview + reviews (right) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Application */}
        <div className="border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <ChallengeCard
            applicantNuid={applicantNuid}
            applicationId={applicationId}
          />

          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setScriptOpen((v) => !v)}
              className="text-text-faint hover:text-text-default flex items-center justify-between text-xs font-semibold tracking-wide uppercase"
            >
              Interview script
              {scriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {scriptOpen && (
              <>
                <Link
                  href={`/reviewer/interview-script?cycle=${cycleId}&role=${role}`}
                  className="text-brand-blue self-start text-xs hover:underline"
                >
                  Open as a full page →
                </Link>
                <InterviewScriptContent cycleId={cycleId} role={role} />
              </>
            )}
          </div>

          <h2 className="text-text-faint mb-4 text-xs font-semibold tracking-wide uppercase">
            Application
          </h2>
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

        {/* Interview + recording reviews */}
        <div className="flex flex-col gap-6 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto">
          {/* Interview write-up */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              Interview
            </h2>

            {interviewSubmitted && (
              <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
                <Lock size={14} />
                You&apos;ve submitted this interview. You can still make changes
                below.
              </div>
            )}

            {!canEditInterview && !interview && (
              <p className="text-text-faint text-sm">
                This interview hasn&apos;t started yet.
              </p>
            )}
            {!canEditInterview && !!interview && (
              <p className="text-text-faint text-sm">
                You&apos;re not the assigned interviewer — showing their
                write-up for context.
              </p>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Recording link</Label>
                {canEditInterview ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={recordingUrl}
                      onChange={(e) => setRecordingUrl(e.target.value)}
                      placeholder="https://…"
                      disabled={upsertInterview.isPending}
                    />
                    {interview?.recording_url && (
                      <a
                        href={interview.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
                      >
                        Open
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ) : interview?.recording_url ? (
                  <a
                    href={interview.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-blue inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {interview.recording_url}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-text-faint text-sm">Not added yet.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Notes link (e.g. Granola)</Label>
                {canEditInterview ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={notesUrl}
                      onChange={(e) => setNotesUrl(e.target.value)}
                      placeholder="https://…"
                      disabled={upsertInterview.isPending}
                    />
                    {interview?.notes_url && (
                      <a
                        href={interview.notes_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
                      >
                        Open
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ) : interview?.notes_url ? (
                  <a
                    href={interview.notes_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-blue inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {interview.notes_url}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-text-faint text-sm">Not added yet.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Comments</Label>
                {canEditInterview ? (
                  <textarea
                    className={TEXTAREA_CLASS}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Summarize how the interview went…"
                    disabled={upsertInterview.isPending}
                  />
                ) : (
                  <p className="text-text-default text-sm whitespace-pre-wrap">
                    {interview?.comments || (
                      <span className="text-text-faint">Not added yet.</span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Rating</Label>
                {canEditInterview ? (
                  <Select
                    value={rating}
                    onValueChange={(v) => setRating(v as InterviewRating)}
                  >
                    <SelectTrigger aria-label="Rating">
                      <SelectValue placeholder="Choose a rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {RATING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-text-default text-sm">
                    {interview?.rating ? (
                      RATING_LABEL[interview.rating]
                    ) : (
                      <span className="text-text-faint">Not rated yet.</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {canEditInterview && (
              <div className="flex flex-col items-stretch gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                {savedInterview && !upsertInterview.isPending && (
                  <span
                    className={`inline-flex items-center gap-1 text-sm sm:mr-auto ${REVIEWED_TEXT}`}
                  >
                    <Check size={14} />
                    Saved
                  </span>
                )}
                {interviewSubmitted ? (
                  <Button
                    onClick={() => saveInterview(true)}
                    disabled={upsertInterview.isPending}
                    className="w-full sm:w-auto"
                  >
                    {upsertInterview.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Saving…
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => saveInterview(false)}
                      disabled={upsertInterview.isPending}
                      className="w-full sm:w-auto"
                    >
                      Save draft
                    </Button>
                    <Button
                      onClick={() => saveInterview(true)}
                      disabled={
                        upsertInterview.isPending || missingInterviewRequired
                      }
                      className="w-full sm:w-auto"
                    >
                      {upsertInterview.isPending ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Saving…
                        </>
                      ) : (
                        'Submit interview'
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recording reviews */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              Recording reviews
            </h2>

            {!interviewSubmitted ? (
              <p className="text-text-faint text-sm">
                Waiting for the interviewer to submit their write-up before
                reviews can start.
              </p>
            ) : (
              <>
                {canReview && (
                  <div className="flex flex-col gap-3">
                    {reviewSubmitted && (
                      <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
                        <Lock size={14} />
                        You&apos;ve submitted your review. You can still make
                        changes below.
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label>Your comments</Label>
                      <textarea
                        className={TEXTAREA_CLASS}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your thoughts on the recording…"
                        disabled={upsertRecordingReview.isPending}
                      />
                    </div>
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                      {savedReview && !upsertRecordingReview.isPending && (
                        <span
                          className={`inline-flex items-center gap-1 text-sm sm:mr-auto ${REVIEWED_TEXT}`}
                        >
                          <Check size={14} />
                          Saved
                        </span>
                      )}
                      {reviewSubmitted ? (
                        <Button
                          onClick={() => saveReview(true)}
                          disabled={upsertRecordingReview.isPending}
                          className="w-full sm:w-auto"
                        >
                          {upsertRecordingReview.isPending ? (
                            <>
                              <Loader2 className="animate-spin" size={14} />
                              Saving…
                            </>
                          ) : (
                            'Save changes'
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => saveReview(false)}
                            disabled={upsertRecordingReview.isPending}
                            className="w-full sm:w-auto"
                          >
                            Save draft
                          </Button>
                          <Button
                            onClick={() => saveReview(true)}
                            disabled={
                              upsertRecordingReview.isPending ||
                              !reviewComment.trim()
                            }
                            className="w-full sm:w-auto"
                          >
                            {upsertRecordingReview.isPending ? (
                              <>
                                <Loader2 className="animate-spin" size={14} />
                                Saving…
                              </>
                            ) : (
                              'Submit review'
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {otherReviews.length > 0 && (
                  <div>
                    <h3 className="text-text-faint mt-2 mb-3 text-xs font-semibold tracking-wide uppercase">
                      Other reviews
                    </h3>
                    <div className="flex flex-col gap-3">
                      {otherReviews.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <span className="text-text-muted text-xs">
                            <ReviewerName nuid={r.reviewer_nuid} />
                          </span>
                          <p className="text-text-default mt-2 text-sm whitespace-pre-wrap">
                            {r.comments ?? (
                              <span className="text-text-faint">
                                Hidden until released.
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!canReview && otherReviews.length === 0 && (
                  <p className="text-text-faint text-sm">No reviews yet.</p>
                )}
              </>
            )}
          </div>

          {/* Open calibration discussion — any reviewer can post */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              Comments
            </h2>
            <div className="flex flex-col gap-3">
              {discussionComments.map((c) => {
                const editing = editingCommentId === c.id
                const edited = c.updated_at !== c.created_at
                const isOwn = c.author_nuid === currentUser?.nuid
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-gray-100 bg-white p-4"
                  >
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value)}
                          rows={3}
                          autoFocus
                          aria-label="Edit comment"
                          className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
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
                        <div>
                          <p className="text-text-muted text-xs">
                            {c.author_name || c.author_nuid}
                          </p>
                          <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                            {c.body}
                          </p>
                          <p className="text-text-faint mt-1.5 text-xs">
                            {new Date(c.created_at).toLocaleString()}
                            {edited && ' · edited'}
                          </p>
                        </div>
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => startEditingComment(c)}
                            className="text-text-faint hover:text-text-muted shrink-0"
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

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment on this applicant…"
                  rows={3}
                  className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
                />
                <div className="mt-3">
                  <Button
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
