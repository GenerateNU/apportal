'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, EyeOff } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { PanelHeading } from '@/components/ui/panel-heading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useCycleHref } from '@/hooks/useCycleHref'
import { useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import {
  CHIEF_VOTE_BY_VALUE,
  CHIEF_VOTES,
  type ChiefVote,
  isSplit,
} from '@/lib/chief-votes'
import { useApplications } from '@/lib/queries/applications'
import {
  useAddChiefReviewComment,
  useCastChiefVote,
  useChiefReviewComments,
  useChiefReviewsByApplicationIds,
  useEditChiefReviewComment,
} from '@/lib/queries/chief-reviews'
import { useReviewRanking } from '@/lib/queries/review-ranking'
import { useCurrentUser } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { ApplicantOverview } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicantOverview'
import { CommentThread } from '@/app/(portal)/(staff)/cycles/[cycleId]/teams/[id]/components/CommentThread'
import { ADVANCEABLE_STAGES } from '../components/cutoff'
import { ChiefVoteSummary, useCycleChiefNuids } from '../components/ChiefVotes'

const ADVANCE_DELAY_MS = 450

export function VoteQueueClient() {
  const scope = useCycleScope()
  const toCycle = useCycleHref()
  const { roleIds, roleLabel } = scope.roles
  const shortlistHref = toCycle(
    `/cycle/shortlist${scope.roleId ? `?role=${scope.roleId}` : ''}`
  )

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        back={
          <Breadcrumbs
            items={[
              { label: 'Shortlist', href: shortlistHref },
              { label: 'Chief votes' },
            ]}
          />
        }
        title="Chief votes"
        subtitle="Go through each applicant and vote. Other chiefs' votes show once you've voted."
        actions={
          roleIds.length > 1 && (
            <Select value={scope.roleId} onValueChange={scope.setRoleId}>
              <SelectTrigger className="w-56" aria-label="Opening">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {roleLabel(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      {!scope.cycleId || !scope.roleId ? (
        <LoadingText />
      ) : (
        <Queue
          key={`${scope.cycleId}:${scope.roleId}`}
          cycleId={scope.cycleId}
          roleId={scope.roleId}
          shortlistHref={shortlistHref}
        />
      )}
    </div>
  )
}

function Queue({
  cycleId,
  roleId,
  shortlistHref,
}: {
  cycleId: string
  roleId: string
  shortlistHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const toast = useToast()
  const { data: me } = useCurrentUser()
  const { data: ranking, isLoading } = useReviewRanking(cycleId, roleId)
  const { data: applications = [] } = useApplications({
    cycle_id: cycleId,
    role_id: roleId,
  })
  const chiefNuids = useCycleChiefNuids(cycleId)
  const cast = useCastChiefVote()
  const [onlyUnvoted, setOnlyUnvoted] = useState(true)
  const [justVoted, setJustVoted] = useState<ChiefVote | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const entries = useMemo(
    () =>
      (ranking?.entries ?? []).filter((e) => ADVANCEABLE_STAGES.has(e.stage)),
    [ranking]
  )
  const ids = useMemo(() => entries.map((e) => e.application_id), [entries])
  const { data: reviews } = useChiefReviewsByApplicationIds(ids)
  const byId = useMemo(
    () => new Map(applications.map((a) => [a.id, a])),
    [applications]
  )

  const myVote = (id: string) =>
    reviews[id]?.find((r) => r.reviewer_nuid === me?.nuid)?.vote
  const votedCount = ids.filter((id) => myVote(id)).length

  const requested = params.get('app')
  const firstUnvoted = ids.find((id) => !myVote(id))
  const currentId =
    (requested && ids.includes(requested) ? requested : null) ??
    firstUnvoted ??
    ids[0]
  const index = currentId ? ids.indexOf(currentId) : -1

  function go(id: string | undefined) {
    if (!id) return
    const next = new URLSearchParams(params)
    next.set('app', id)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    window.scrollTo({ top: 0 })
  }

  function step(direction: 1 | -1, skipVoted: boolean) {
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(index + direction * k + ids.length) % ids.length]
      if (!skipVoted || !myVote(id)) return go(id)
    }
  }

  function vote(value: ChiefVote) {
    if (!currentId || cast.isPending) return
    const votingOn = currentId
    cast.mutate(
      { applicationId: votingOn, vote: value },
      {
        onSuccess: () => {
          setJustVoted(value)
          if (advanceTimer.current) clearTimeout(advanceTimer.current)
          advanceTimer.current = setTimeout(() => {
            setJustVoted(null)
            const rest = ids.filter((id) => id !== votingOn && !myVote(id))
            if (onlyUnvoted && rest.length > 0) {
              const after = ids
                .slice(ids.indexOf(votingOn) + 1)
                .concat(ids.slice(0, ids.indexOf(votingOn)))
                .find((id) => rest.includes(id))
              go(after)
            }
          }, ADVANCE_DELAY_MS)
        },
        onError: (err) => {
          const message = apiErrorDetail(err)
          if (message) toast(message, { variant: 'error' })
        },
      }
    )
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      target?.closest('input, textarea, select, [contenteditable="true"]')
    )
      return
    const choice = CHIEF_VOTES.find((v) => v.key === e.key)
    if (choice) {
      e.preventDefault()
      vote(choice.value)
    } else if (e.key === 'j' || e.key === 'ArrowRight') {
      e.preventDefault()
      step(1, false)
    } else if (e.key === 'k' || e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1, false)
    }
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener)
    return () => {
      window.removeEventListener('keydown', listener)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  if (isLoading) return <LoadingText />
  if (ids.length === 0) {
    return (
      <EmptyState
        title="No one is waiting on a chief decision"
        description="Applicants show up here while they're in review."
      />
    )
  }

  const splitCount = ids.filter((id) =>
    isSplit((reviews[id] ?? []).map((r) => r.vote))
  ).length
  const allDone = votedCount === ids.length

  const entry = entries[index]
  const app = currentId ? byId.get(currentId) : undefined
  const mine = currentId ? myVote(currentId) : undefined
  const shown = justVoted ?? mine

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gray-200 pb-4">
        <div className="flex min-w-60 flex-1 items-center gap-3">
          <span className="text-ink text-sm font-medium tabular-nums">
            {votedCount} of {ids.length} voted
          </span>
          <span className="h-1.5 max-w-80 flex-1 overflow-hidden bg-gray-100">
            <span
              className="bg-ink block h-full transition-[width]"
              style={{ width: `${(votedCount / ids.length) * 100}%` }}
            />
          </span>
        </div>
        <label className="text-text-muted flex items-center gap-2 text-sm">
          <Checkbox
            checked={onlyUnvoted}
            onCheckedChange={(v) => setOnlyUnvoted(v === true)}
          />
          Skip ones I&apos;ve voted on
        </label>
        <span className="text-text-subtle text-xs">
          Keys: 1–5 vote · J next · K back
        </span>
      </div>

      {allDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            You&apos;ve voted on all {ids.length}.
            {splitCount > 0 &&
              ` ${splitCount} ${splitCount === 1 ? 'has' : 'have'} split votes to talk through.`}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={shortlistHref}>Back to Shortlist</Link>
          </Button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0">
          {app && (
            <ApplicantOverview
              key={app.id}
              applicationId={app.id}
              cycleId={cycleId}
              role={roleId}
              applicantNuid={app.user_nuid}
              stage={app.stage}
            />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:border-l xl:border-gray-200 xl:pl-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous applicant"
              title="Previous (K)"
              onClick={() => step(-1, false)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-text-muted text-sm tabular-nums">
              {index + 1} of {ids.length}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next applicant"
              title="Next (J)"
              onClick={() => step(1, false)}
            >
              <ChevronRight />
            </Button>
          </div>

          {entry && (
            <dl className="grid grid-cols-3 border border-gray-200 text-center">
              <Stat label="Rank" value={entry.rank ?? '—'} />
              <Stat
                label="Average"
                value={
                  entry.scaled_average != null
                    ? `${Math.round(entry.scaled_average * 100)}%`
                    : '—'
                }
              />
              <Stat
                label="Z-score"
                value={
                  entry.normalized_score != null
                    ? entry.normalized_score.toFixed(2)
                    : '—'
                }
              />
            </dl>
          )}

          <section className="flex flex-col gap-2">
            <PanelHeading>Your vote</PanelHeading>
            <div className="flex flex-col gap-1.5">
              {CHIEF_VOTES.map((v) => {
                const active = shown === v.value
                return (
                  <button
                    key={v.value}
                    type="button"
                    disabled={cast.isPending}
                    onClick={() => vote(v.value)}
                    className={cn(
                      'flex items-center gap-3 border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
                      active
                        ? cn(v.chip, 'font-semibold')
                        : 'text-ink border-gray-200 bg-white hover:bg-gray-50'
                    )}
                  >
                    <span className={cn('size-2.5 rounded-full', v.dot)} />
                    <span className="flex-1">{v.label}</span>
                    {active ? (
                      <Check size={14} />
                    ) : (
                      <kbd className="text-text-subtle border border-gray-200 px-1.5 text-[11px]">
                        {v.key}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
            {justVoted && (
              <span className="text-xs text-emerald-700">Saved</span>
            )}
          </section>

          {currentId && (
            <OtherChiefs
              key={currentId}
              applicationId={currentId}
              reviews={reviews[currentId] ?? []}
              chiefNuids={chiefNuids}
              myNuid={me?.nuid}
              revealed={!!mine}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col px-2 py-2 not-first:border-l not-first:border-gray-200">
      <dt className="text-text-subtle text-[11px] tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-ink font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function OtherChiefs({
  applicationId,
  reviews,
  chiefNuids,
  myNuid,
  revealed,
}: {
  applicationId: string
  reviews: ReturnType<typeof useChiefReviewsByApplicationIds>['data'][string]
  chiefNuids: string[]
  myNuid?: string
  revealed: boolean
}) {
  const { data: comments = [] } = useChiefReviewComments(
    revealed ? applicationId : ''
  )
  const add = useAddChiefReviewComment(applicationId)
  const edit = useEditChiefReviewComment(applicationId)
  const others = reviews.filter((r) => r.reviewer_nuid !== myNuid && r.vote)

  if (!revealed) {
    return (
      <section className="flex flex-col gap-2">
        <PanelHeading>Other chiefs</PanelHeading>
        <p className="text-text-muted flex items-center gap-2 border border-dashed border-gray-300 px-3 py-3 text-sm">
          <EyeOff size={14} className="shrink-0" />
          Hidden until you vote, so your call is your own.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <PanelHeading
          aside={<ChiefVoteSummary reviews={reviews} chiefNuids={chiefNuids} />}
        >
          Other chiefs
        </PanelHeading>
        {others.length === 0 ? (
          <p className="text-text-muted text-sm">No one else has voted yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {others.map((r) => {
              const v = CHIEF_VOTE_BY_VALUE.get(r.vote!)
              return (
                <li
                  key={r.reviewer_nuid}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-ink truncate">
                    {r.reviewer_name || r.reviewer_nuid}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 text-xs',
                      v?.chip
                    )}
                  >
                    <span className={cn('size-2 rounded-full', v?.dot)} />
                    {v?.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <PanelHeading>Discussion</PanelHeading>
        <CommentThread
          comments={comments}
          currentUserNuid={myNuid}
          onAdd={(body) => add.mutate(body)}
          onEdit={(commentId, body) => edit.mutate({ commentId, body })}
          isAdding={add.isPending}
          isEditing={edit.isPending}
          placeholder="Share why, for the chiefs' discussion…"
        />
      </section>
    </>
  )
}
