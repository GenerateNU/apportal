'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, RotateCcw, TriangleAlert } from 'lucide-react'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail } from '@/lib/api/client'
import { useApplications } from '@/lib/queries/applications'
import {
  type CutoffMode,
  useReviewRanking,
  useAdvanceShortlist,
  useSetCutoff,
  useClearOverrides,
  useSetCutoffOverride,
} from '@/lib/queries/review-ranking'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { cn } from '@/lib/utils'
import { formatDeadline } from '@/lib/deadline'
import {
  dueAt as pipelineDue,
  perApplicant,
  useCycleSteps,
  useWorkflow,
} from '@/lib/queries/workflow'
import { useReviewBoard } from '@/lib/queries/reviewer-pools'
import { useCycleScope } from '@/hooks/useCycleScope'
import { ApplicationDetail } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicationDetail'
import { ADVANCEABLE_STAGES, type CutoffDraft, previewEntries } from './cutoff'
import { Stats } from '@/components/ui/facts'
import { useCycleHref } from '@/hooks/useCycleHref'

const STAGE_LABEL: Record<string, string> = {
  interview: 'Interview',
  interview_scheduled: 'Interview',
  interview_conducted: 'Interview',
  interview_review: 'Interview review',
  selection: 'Decisions',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export function CutoffClient() {
  const scope = useCycleScope()
  const { roleIds, roleLabel } = scope.roles

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Shortlist"
        subtitle="Applicants selected to advance to the next round, ranked by score."
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
        scope.isLoading || scope.roles.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="Pick a cycle with at least one opening" />
        )
      ) : (
        <Ranking
          key={`${scope.cycleId}:${scope.roleId}`}
          cycleId={scope.cycleId}
          roleId={scope.roleId}
        />
      )}
    </div>
  )
}

function Ranking({ cycleId, roleId }: { cycleId: string; roleId: string }) {
  const toCycle = useCycleHref()
  const toast = useToast()
  const { data: ranking, isLoading } = useReviewRanking(cycleId, roleId)
  const { data: applications = [] } = useApplications({
    cycle_id: cycleId,
    role_id: roleId,
  })
  const { data: steps = [] } = useCycleSteps(cycleId)
  const { data: questions = [], isLoading: questionsLoading } =
    useReviewQuestions(cycleId, roleId)
  const { data: board = [], isLoading: boardLoading } = useReviewBoard(cycleId)
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(cycleId)
  const { mutate: saveCutoff, isPending: saving } = useSetCutoff(
    cycleId,
    roleId
  )
  const setOverride = useSetCutoffOverride(cycleId, roleId)
  const clearOverrides = useClearOverrides(cycleId, roleId)
  const advance = useAdvanceShortlist(cycleId, roleId)

  const saved: CutoffDraft = ranking?.cutoff
    ? { mode: ranking.cutoff.mode as CutoffMode, value: ranking.cutoff.value }
    : { mode: 'none', value: 0 }
  const [draft, setDraft] = useState<CutoffDraft | null>(null)
  const current = draft ?? saved
  const dirty =
    !!draft && (draft.mode !== saved.mode || draft.value !== saved.value)
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty || Number.isNaN(current.value)) return
    const t = setTimeout(
      () =>
        saveCutoff(
          current.mode === 'none'
            ? null
            : { mode: current.mode, value: current.value },
          { onError: (err) => toast(apiErrorDetail(err), { variant: 'error' }) }
        ),
      500
    )
    return () => clearTimeout(t)
  }, [dirty, current.mode, current.value, saveCutoff, toast])

  const required = perApplicant(steps, 'reviews', 'reviewer')
  const order = steps.filter((s) => s.enabled).map((s) => s.step)
  const nextLabel =
    steps.find((s) => s.step === order[order.indexOf('reviews') + 1])?.label ??
    'the next step'

  const byId = useMemo(
    () => new Map(applications.map((a) => [a.id, a])),
    [applications]
  )
  const entries = useMemo(
    () => previewEntries(ranking?.entries ?? [], current),
    [ranking, current]
  )
  const scored = questions.some((q) => q.question_type === 'score' && q.ranked)

  const inReview = entries.filter((e) => ADVANCEABLE_STAGES.has(e.stage))
  const toAdvance = inReview.filter((e) => e.included)
  const handPicked = inReview.filter((e) => e.override !== undefined).length
  const isOut = (stage: string) => stage === 'rejected' || stage === 'withdrawn'
  const rejected = entries.filter((e) => isOut(e.stage)).length
  const movedOn = entries.length - inReview.length - rejected
  const ranked = entries.filter((e) => e.rank != null).length
  const aboveCount = entries.filter((e) => e.above_cutoff).length
  const lastAbove = entries.reduce(
    (last, e, i) => (e.above_cutoff ? i : last),
    -1
  )

  function setMode(mode: CutoffDraft['mode']) {
    setDraft({
      mode,
      value:
        mode === current.mode
          ? current.value
          : mode === 'top_n'
            ? Math.min(ranked, 20)
            : 0,
    })
  }

  async function toggle(e: (typeof entries)[number]) {
    const next = !e.included
    try {
      await setOverride.mutateAsync({
        applicationId: e.application_id,
        included: next === e.above_cutoff ? null : next,
      })
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function selectAllOrNone() {
    setDraft(
      toAdvance.length
        ? { mode: 'none', value: 0 }
        : { mode: 'top_n', value: ranked }
    )
    try {
      await clearOverrides.mutateAsync()
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function reset(applicationId: string) {
    try {
      await setOverride.mutateAsync({ applicationId, included: null })
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function advanceAll() {
    try {
      const moved = (
        await advance.mutateAsync({
          applicationIds: toAdvance.map((e) => e.application_id),
        })
      )?.moved
      setConfirmAdvance(false)
      const count = moved?.length ?? toAdvance.length
      toast(`Moved ${count} to ${nextLabel}`)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  if (isLoading || questionsLoading || boardLoading || workflowLoading)
    return <LoadingText />

  const assigned = board
    .filter((r) => r.roleId === roleId)
    .flatMap((r) => r.reviewers)
  const reviewsIn = assigned.filter((x) => x.submitted).length
  const dueAt = pipelineDue(workflow, 'reviews', roleId, 'reviewer')
  const due = dueAt ? new Date(dueAt) : null
  const reviewsClosed = !!due && due < new Date()
  if (
    inReview.length > 0 &&
    (assigned.length === 0 || (reviewsIn < assigned.length && !reviewsClosed))
  ) {
    return (
      <EmptyState
        title="Shortlist opens once reviews are in"
        description={
          assigned.length === 0 ? (
            'Assign reviewers and release reviews first.'
          ) : (
            <Stats
              className="text-ink mt-2 justify-center"
              items={[
                {
                  label: 'Reviews in',
                  value: `${reviewsIn} of ${assigned.length}`,
                },
                due && { label: 'Reviews close', value: formatDeadline(due) },
              ]}
            />
          )
        }
        action={
          <Link
            href={
              assigned.length === 0
                ? toCycle('/cycle/assign-reviewers')
                : toCycle('/cycle/assign-reviewers')
            }
            className="text-ink inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {assigned.length === 0 ? 'Assign reviewers' : 'See progress'}{' '}
            <ArrowRight size={14} />
          </Link>
        }
      />
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No applicants for this opening yet"
        description="Once reviews come in, applicants show up here ranked."
      />
    )
  }

  const opened = open ? byId.get(open) : undefined

  return (
    <div className="flex flex-col gap-4">
      {!scored ? (
        <Notice>
          No score question counts toward the ranking yet.{' '}
          <Link
            href={toCycle('/cycle/review-forms')}
            className="font-medium underline"
          >
            Edit the review form
          </Link>
        </Notice>
      ) : null}

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          <span className="text-ink text-sm">Advance</span>
          <Select
            value={current.mode}
            onValueChange={(v) => setMode(v as CutoffDraft['mode'])}
          >
            <SelectTrigger
              className="h-9 w-auto gap-2"
              aria-label="How to pick"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top_n">the top</SelectItem>
              <SelectItem value="min_score">
                everyone scoring at least
              </SelectItem>
              <SelectItem value="none">only who I check</SelectItem>
            </SelectContent>
          </Select>
          {current.mode !== 'none' && (
            <Input
              type="number"
              step={current.mode === 'top_n' ? 1 : 0.1}
              min={current.mode === 'top_n' ? 0 : undefined}
              value={Number.isNaN(current.value) ? '' : current.value}
              onChange={(e) =>
                setDraft({ ...current, value: e.target.valueAsNumber })
              }
              className="h-9 w-20"
              aria-label="Cutoff value"
            />
          )}
          {current.mode === 'top_n' && aboveCount > current.value && (
            <span className="text-text-muted text-sm">
              {aboveCount} with ties
            </span>
          )}
          <span className="text-text-subtle ml-auto text-xs">
            {dirty || saving ? 'Saving…' : 'Saved'}
          </span>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="font-display text-ink/60 sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-left text-[11px] tracking-wider uppercase [&_th]:font-normal">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={
                      toAdvance.length === 0
                        ? false
                        : toAdvance.length === inReview.length
                          ? true
                          : 'indeterminate'
                    }
                    disabled={clearOverrides.isPending || inReview.length === 0}
                    onCheckedChange={selectAllOrNone}
                    aria-label={
                      toAdvance.length ? 'Select no one' : 'Select everyone'
                    }
                  />
                </th>
                <th className="w-10 px-2 py-2">#</th>
                <th className="px-3 py-2">Applicant</th>
                <th className="px-3 py-2 text-right">Average</th>
                <th className="px-3 py-2 text-right">Z-score</th>
                <th className="w-40 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const app = byId.get(e.application_id)
                const advanceable = ADVANCEABLE_STAGES.has(e.stage)
                const incomplete = required > 0 && e.review_count < required
                return (
                  <Fragment key={e.application_id}>
                    <tr
                      onClick={() => setOpen(e.application_id)}
                      className={cn(
                        'cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50',
                        !e.included && advanceable && 'text-text-muted'
                      )}
                    >
                      <td
                        className="px-3 py-2"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Checkbox
                          checked={advanceable ? e.included : !isOut(e.stage)}
                          disabled={!advanceable || setOverride.isPending}
                          onCheckedChange={() => toggle(e)}
                          aria-label={`Advance ${app?.full_name ?? 'applicant'}`}
                        />
                      </td>
                      <td className="text-text-subtle px-2 py-2 tabular-nums">
                        {e.rank == null
                          ? '—'
                          : i > 0 &&
                              entries[i - 1].normalized_score ===
                                e.normalized_score
                            ? '='
                            : e.rank}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 font-medium',
                          isOut(e.stage)
                            ? 'text-text-subtle'
                            : e.included || !advanceable
                              ? 'text-ink'
                              : 'text-text-muted'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {app?.full_name ?? 'Applicant'}
                          {incomplete && advanceable && (
                            <span className="text-xs font-normal text-amber-600">
                              {required - e.review_count} review
                              {required - e.review_count === 1 ? '' : 's'}{' '}
                              missing
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="text-text-muted px-3 py-2 text-right tabular-nums">
                        {e.scaled_average != null
                          ? `${Math.round(e.scaled_average * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {e.normalized_score != null
                          ? e.normalized_score.toFixed(2)
                          : '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {!advanceable ? (
                          <Badge size="sm">
                            {STAGE_LABEL[e.stage] ?? e.stage}
                          </Badge>
                        ) : (
                          e.override !== undefined && (
                            <span className="text-text-muted inline-flex items-center gap-1 text-xs">
                              {e.override ? 'Added by hand' : 'Left out'}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Undo"
                                title="Let the cutoff decide"
                                disabled={setOverride.isPending}
                                onClick={() => reset(e.application_id)}
                              >
                                <RotateCcw />
                              </Button>
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                    {i === lastAbove && current.mode !== 'none' && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="border-ink text-ink flex items-center gap-3 border-t-2 border-dashed px-3 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                            Cutoff
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <span className="text-sm">
            {toAdvance.length > 0 ? (
              <>
                <span className="text-ink font-semibold">
                  {toAdvance.length}
                </span>{' '}
                <span className="text-text-muted">selected</span>
                {handPicked > 0 && (
                  <span className="text-text-muted ml-3">
                    {handPicked} changed by hand
                  </span>
                )}
              </>
            ) : movedOn > 0 || rejected > 0 ? (
              <span className="text-ink inline-flex items-center gap-1.5">
                {movedOn > 0 && (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    {movedOn} moved on
                  </>
                )}
                {rejected > 0 && (
                  <span
                    className={cn('text-text-muted', movedOn > 0 && 'ml-1.5')}
                  >
                    {rejected} rejected
                  </span>
                )}
              </span>
            ) : null}
            <span className="text-text-muted ml-3 text-xs">
              Z-scores adjust for reviewer bias.
            </span>
          </span>
          <Button
            disabled={
              toAdvance.length === 0 || dirty || saving || advance.isPending
            }
            onClick={() => setConfirmAdvance(true)}
          >
            Advance {toAdvance.length || ''} to {nextLabel}
            <ArrowRight />
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmAdvance}
        onOpenChange={setConfirmAdvance}
        title={`Advance ${toAdvance.length} to ${nextLabel}?`}
        description={
          inReview.length > toAdvance.length
            ? `${inReview.length - toAdvance.length} not picked will be rejected, and Reviews is marked done.`
            : 'Reviews is marked done.'
        }
        confirmLabel={
          inReview.length > toAdvance.length
            ? 'Advance and reject the rest'
            : 'Advance'
        }
        pending={advance.isPending}
        onConfirm={advanceAll}
      />

      {opened && (
        <ApplicationDetail
          applicant={{
            id: opened.id,
            nuid: opened.user_nuid,
            fullName: opened.full_name,
            email: opened.email,
            role: opened.role_id,
            cycleId,
            stage: opened.stage,
            submittedAt: opened.submitted_at,
            returner: opened.returner,
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <TriangleAlert size={14} className="shrink-0" />
      <span>{children}</span>
    </p>
  )
}
