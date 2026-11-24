'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { ChallengeMetrics, ChallengeScore } from '@/lib/api/types'
import { useApplicant } from '@/lib/queries/applicants'
import { useChallengeScore } from '@/lib/queries/challenge-score'
import { useChallenges } from '@/lib/queries/challenges'
import { useSubmission } from '@/lib/queries/submissions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PanelHeading } from '@/components/ui/panel-heading'
import { SectionLabel } from '@/components/ui/section-label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'
import { Stats } from '@/components/ui/facts'

const CHALLENGE_METRIC_LABEL: { key: keyof ChallengeMetrics; label: string }[] =
  [
    { key: 'throughput', label: 'Throughput' },
    { key: 'gateUtilization', label: 'Gate utilization' },
    { key: 'arrivalSuccess', label: 'Arrival success' },
    { key: 'fairness', label: 'Fairness' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'slaCompliance', label: 'SLA compliance' },
  ]

const CHALLENGE_GITHUB_ORG = 'generate-recruit'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type RepoSearch = { label: string; query: string }

function challengeRepoSearches(fullName: string): RepoSearch[] {
  const parts = fullName.trim().split(/\s+/).map(slugify).filter(Boolean)
  if (parts.length === 0) return []
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const searches: RepoSearch[] = []
  if (last)
    searches.push({
      label: 'Full name',
      query: `f26-challenge-${first}-${last}`,
    })
  searches.push({ label: 'First name only', query: `f26-challenge-${first}` })
  if (last)
    searches.push({ label: 'Last name only', query: `f26-challenge-${last}` })
  return searches
}

function challengeRepoSearchUrl(query: string): string {
  return `https://github.com/orgs/${CHALLENGE_GITHUB_ORG}/repositories?q=${encodeURIComponent(query)}`
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return url
  }
}

const LINK_CLASS =
  'text-ink inline-flex min-w-0 items-center gap-1 text-sm hover:underline'

export function ChallengeCard({
  applicantNuid,
  applicationId,
  cycleId,
  role,
  bare = false,
}: {
  applicantNuid: string
  applicationId: string
  cycleId: string
  role: string
  bare?: boolean
}) {
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { data: score, isLoading: scoreLoading } =
    useChallengeScore(applicantNuid)
  const { data: submission, isLoading: submissionLoading } =
    useSubmission(applicationId)
  const { data: applicant } = useApplicant(applicantNuid)

  if (challenges.length === 0) return null

  const repoSearches = applicant
    ? challengeRepoSearches(applicant.full_name)
    : []

  const body = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {bare ? (
          <PanelHeading>Technical challenge</PanelHeading>
        ) : (
          <SectionLabel>Technical challenge</SectionLabel>
        )}
        {challenges.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <div className="flex flex-col">
              <span className="text-ink text-base font-semibold">{c.name}</span>
              {c.due_at && (
                <span className="text-text-muted text-xs">
                  Due {formatDate(c.due_at)}
                </span>
              )}
            </div>
            {c.challenge_url && (
              <a
                href={c.challenge_url}
                target="_blank"
                rel="noreferrer"
                className={LINK_CLASS}
              >
                Prompt
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
      </div>

      <Row label="Submission">
        {submissionLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : submission ? (
          <a
            href={submission.submission_url}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            <span className="truncate">
              {displayUrl(submission.submission_url)}
            </span>
            <ExternalLink size={12} className="shrink-0" />
          </a>
        ) : (
          <span className="text-text-faint text-sm">Not submitted</span>
        )}
      </Row>

      {repoSearches.length > 0 && (
        <Row label="Repo">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {repoSearches.map(({ label, query }) => (
              <a
                key={query}
                href={challengeRepoSearchUrl(query)}
                target="_blank"
                rel="noreferrer"
                title={`Search the org for ${query}`}
                className={LINK_CLASS}
              >
                {label}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </Row>
      )}

      {score ? (
        <ScoreBlock score={score} />
      ) : (
        <Row label="Score">
          {scoreLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span className="text-text-faint text-sm">
              No finished attempt yet
            </span>
          )}
        </Row>
      )}
    </div>
  )

  return bare ? body : <Card className="p-5">{body}</Card>
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-gray-100 pb-3">
      <span className="font-display text-text-subtle w-24 shrink-0 text-[11px] tracking-wider uppercase">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ScoreBlock({ score }: { score: ChallengeScore }) {
  const [showHistory, setShowHistory] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <span className="flex flex-col gap-1">
          <span className="font-display text-ink text-4xl leading-none font-bold">
            {score.overall_score.toFixed(1)}
          </span>
          <span className="font-display text-text-subtle text-[10px] font-bold tracking-[0.12em] uppercase">
            Overall
          </span>
        </span>
        <Stats
          className="text-ink pb-0.5"
          items={[
            { label: 'Finished attempts', value: score.attempt_count },
            { label: 'Last finished', value: formatDate(score.finished_at) },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 border-t border-l border-gray-200 sm:grid-cols-3">
        {CHALLENGE_METRIC_LABEL.map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col gap-1 border-r border-b border-gray-200 px-3 py-2.5"
          >
            <span className="font-display text-text-subtle text-[10px] tracking-wider uppercase">
              {label}
            </span>
            <span className="text-ink text-base font-semibold tabular-nums">
              {score.metrics[key].toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {score.attempts.length > 1 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-text-muted hover:text-ink inline-flex w-fit items-center gap-1 text-xs"
          >
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showHistory ? 'Hide' : 'Show'} all attempts (
            {score.attempts.length})
          </button>
          {showHistory && (
            <div className="flex flex-col border-t border-gray-100">
              {score.attempts.map((attempt) => {
                const counted = attempt.expedition_id === score.expedition_id
                return (
                  <div
                    key={attempt.expedition_id}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 text-sm"
                  >
                    <span className="text-text-muted">
                      {formatDate(attempt.finished_at)}
                    </span>
                    <span className="flex items-center gap-2">
                      {counted && <Badge size="sm">Counted</Badge>}
                      <span
                        className={cn(
                          'tabular-nums',
                          counted
                            ? 'text-ink font-semibold'
                            : 'text-text-default'
                        )}
                      >
                        {attempt.overall_score.toFixed(1)}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
