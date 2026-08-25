'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { ApplicationStage, Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useInterviewComments } from '@/lib/queries/interview-comments'
import { useInterview } from '@/lib/queries/interviews'
import { useQuestions } from '@/lib/queries/questions'
import { useRecordingReviews } from '@/lib/queries/recording-reviews'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useChiefs, useLeads } from '@/lib/queries/users'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { ChallengeCard } from './ChallengeCard'
import { stageBadge, stageLabel } from './constants'
import { ResponseField } from './ResponseField'

const SECTION_CLASS =
  'flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm'
const SECTION_HEADER_CLASS =
  'text-text-faint text-xs font-semibold tracking-wide uppercase'
const SUBCARD_CLASS = 'rounded-xl border border-gray-100 bg-white p-4'

// A single "everything about this applicant" view — application answers,
// lead reviews, the interview write-up/rating, recording reviews, and the
// open comment thread — so a reviewer doesn't have to hop between separate
// pages to get the full picture. Deliberately excludes chief review data,
// which stays on its own page. Shared between the applications table's
// slide-over drawer and the full applicant page; each data source is fetched
// fresh on mount here (a single applicant's worth, not a per-row batch), the
// same way the interview/review detail pages already do.
export function ApplicantOverview({
  applicationId,
  cycleId,
  role,
  applicantNuid,
  stage,
}: {
  applicationId: string
  cycleId: string
  role: Role
  applicantNuid: string
  stage?: ApplicationStage
}) {
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()

  const nameByNuid = new Map<string, string>()
  for (const u of [...leads, ...chiefs]) nameByNuid.set(u.nuid, u.full_name)

  // Lead reviews: the backend already withholds other reviewers' answers
  // from a plain lead until a chief releases them for this cycle/role, same
  // gating the lead-review page itself relies on.
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: writtenReviews = [] } = useWrittenReviews(applicationId)

  const { data: interview } = useInterview(applicationId)
  // Recording reviews have the same kind of release gate — a row can exist
  // with `comments: null` ("Hidden until released") rather than being
  // omitted outright.
  const { data: recordingReviews = [] } = useRecordingReviews(
    interview?.id ?? ''
  )
  const { data: comments = [] } = useInterviewComments(applicationId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <Avatar name={applicant?.full_name ?? ''} size="lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-text-default text-2xl font-semibold">
              {applicant?.full_name ?? 'Applicant'}
            </h1>
            <span
              className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[role]}`}
            >
              {ROLE_LABEL[role]}
            </span>
            {stage && (
              <span
                className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${stageBadge[stage]}`}
              >
                {stageLabel[stage]}
              </span>
            )}
            {interview?.rating && (
              <span
                className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
              >
                {RATING_LABEL[interview.rating]}
              </span>
            )}
          </div>
          <p className="text-text-muted mt-1 text-sm">{applicant?.email}</p>
        </div>
      </div>

      <ChallengeCard
        applicantNuid={applicantNuid}
        applicationId={applicationId}
        role={role}
      />

      <div className={SECTION_CLASS}>
        <h2 className={SECTION_HEADER_CLASS}>Application</h2>
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

      <div className={SECTION_CLASS}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={SECTION_HEADER_CLASS}>Lead reviews</h2>
          <Link
            href={`/reviewer/my-reviews/${applicationId}`}
            className="text-brand-blue text-xs hover:underline"
          >
            Open review page →
          </Link>
        </div>
        {writtenReviews.length === 0 ? (
          <p className="text-text-faint text-sm">No lead reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {writtenReviews.map((r) => (
              <div key={r.id} className={SUBCARD_CLASS}>
                <span className="text-text-muted text-xs">
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
                        <p className="text-text-default text-sm whitespace-pre-wrap">
                          {display}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={SECTION_CLASS}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={SECTION_HEADER_CLASS}>Interview</h2>
          <Link
            href={`/reviewer/my-interviews/${applicationId}`}
            className="text-brand-blue text-xs hover:underline"
          >
            Open interview page →
          </Link>
        </div>
        {!interview ? (
          <p className="text-text-faint text-sm">Not yet interviewed.</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Interviewer:</span>
              <span className="text-text-default font-medium">
                {nameByNuid.get(interview.interviewer_nuid) ??
                  interview.interviewer_nuid}
              </span>
              {interview.submitted_at && (
                <span className="text-text-faint text-xs">· Submitted</span>
              )}
            </div>
            {(interview.recording_url || interview.notes_url) && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {interview.recording_url && (
                  <a
                    href={interview.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-blue inline-flex items-center gap-1 hover:underline"
                  >
                    Recording
                    <ExternalLink size={10} />
                  </a>
                )}
                {interview.notes_url && (
                  <a
                    href={interview.notes_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-blue inline-flex items-center gap-1 hover:underline"
                  >
                    Notes
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
            <div>
              <p className="text-text-muted text-xs font-medium">Write-up</p>
              <p className="text-text-default mt-1 whitespace-pre-wrap">
                {interview.comments || (
                  <span className="text-text-faint">No write-up yet.</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {interview && (
        <div className={SECTION_CLASS}>
          <h2 className={SECTION_HEADER_CLASS}>Recording reviews</h2>
          {recordingReviews.length === 0 ? (
            <p className="text-text-faint text-sm">No reviews yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recordingReviews.map((r) => (
                <div key={r.id} className={SUBCARD_CLASS}>
                  <span className="text-text-muted text-xs">
                    {nameByNuid.get(r.reviewer_nuid) ?? r.reviewer_nuid}
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
          )}
        </div>
      )}

      <div className={SECTION_CLASS}>
        <h2 className={SECTION_HEADER_CLASS}>Comments</h2>
        {comments.length === 0 ? (
          <p className="text-text-faint text-sm">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((c) => (
              <div key={c.id} className={SUBCARD_CLASS}>
                <p className="text-text-muted text-xs">
                  {c.author_name || c.author_nuid}
                </p>
                <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                  {c.body}
                </p>
                <p className="text-text-faint mt-1.5 text-xs">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
