'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { ChallengeMetrics, Role } from '@/lib/api/types'
import { useApplicant } from '@/lib/queries/applicants'
import { useChallengeScore } from '@/lib/queries/challenge-score'
import { useSubmission } from '@/lib/queries/submissions'

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
// a reviewer doesn't have to leave this page to find either. Shared between
// the interview conduct page and the applicant overview page.
export function ChallengeCard({
  applicantNuid,
  applicationId,
  role,
}: {
  applicantNuid: string
  applicationId: string
  role: Role
}) {
  const { data: score } = useChallengeScore(applicantNuid)
  const { data: submission } = useSubmission(applicationId)
  const { data: applicant } = useApplicant(applicantNuid)
  const [showHistory, setShowHistory] = useState(false)

  // The challenge is engineer-only — try a best-effort repo match for every
  // engineering interviewee, not just those who already have a score, since
  // a repo can exist even if they never finished (or started) an attempt.
  const repoQueries =
    role === 'software_engineer' && applicant
      ? buildChallengeRepoQueries(applicant.full_name)
      : []

  if (!score && !submission && repoQueries.length === 0) return null

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
    </div>
  )
}
