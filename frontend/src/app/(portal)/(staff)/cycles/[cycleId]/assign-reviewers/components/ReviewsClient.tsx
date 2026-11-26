'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight, Check, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/components/ui/toast'
import { useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import { formatDeadline } from '@/lib/deadline'
import {
  dueAt,
  openingIn,
  perApplicant,
  useCycleSteps,
  useWorkflow,
  useWorkflowMutations,
} from '@/lib/queries/workflow'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import { queryKeys } from '@/lib/queries/keys'
import { useUnassignAllLeads } from '@/lib/queries/lead-assignments'
import { useCycleTemplateSummary } from '@/lib/queries/cycles'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import {
  type AutoAssignPlan,
  type BoardEntry,
  useAutoAssign,
  useBoardAssign,
  useReviewBoard,
  useReviewConflicts,
  useStaffing,
} from '@/lib/queries/reviewer-pools'
import { useReviewerProgressByRoles } from '@/lib/queries/reviewer-progress'
import { cn } from '@/lib/utils'
import type { ApplicationStage } from '@/lib/api/types'
import { stageLabel } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/constants'
import { ConflictsEditor } from '../../components/PositionTeams'
import { TruncatedName } from '@/components/ui/truncated-name'
import { useCycleHref } from '@/hooks/useCycleHref'

export type PositionState = {
  roleId: string
  name: string
  applicants: number
  closesAt: Date | null
  closed: boolean
  hasRubric: boolean
  assigned: number
  reviewed: number
  reviews: number
  reviewStatus?: string
  reviewClosesAt: Date | null
}

export function usePositions() {
  const scope = useCycleScope()
  const cycleId = scope.cycleId
  const roleIds = scope.roles.roleIds
  const progress = useReviewerProgressByRoles(cycleId, roleIds)
  const summaryQuery = useCycleTemplateSummary(cycleId)
  const questionsQuery = useReviewQuestions(cycleId)
  const stepsQuery = useCycleSteps(cycleId)
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(cycleId)
  const summaries = summaryQuery.data ?? []
  const reviewQuestions = questionsQuery.data ?? []
  const steps = stepsQuery.data ?? []
  const isLoading =
    summaryQuery.isLoading ||
    questionsQuery.isLoading ||
    stepsQuery.isLoading ||
    workflowLoading ||
    progress.some((q) => q.isLoading)
  const coverage = perApplicant(steps, 'reviews', 'reviewer')

  const positions: PositionState[] = roleIds.map((roleId, i) => {
    const items = (progress[i]?.data ?? []).flatMap((p) => p.items)
    const applying = dueAt(workflow, 'applications', roleId, 'applicant')
    const closesAt = applying ? new Date(applying) : null
    const reviewState = openingIn(workflow, 'reviews', roleId)?.state
    const reviewDue = dueAt(workflow, 'reviews', roleId, 'reviewer')
    return {
      roleId,
      name: scope.roles.roleLabel(roleId),
      applicants:
        summaries.find((s) => s.role_id === roleId)?.submission_count ?? 0,
      closesAt,
      closed: openingIn(workflow, 'applications', roleId)?.state === 'closed',
      hasRubric: reviewQuestions.some(
        (q) =>
          q.question_type === 'score' &&
          (q.role_id === null || q.role_id === roleId)
      ),
      assigned: new Set(items.map((x) => x.application_id)).size,
      reviewed: items.filter((x) => x.submitted_at).length,
      reviews: items.length,
      reviewStatus: reviewState === 'draft' ? undefined : reviewState,
      reviewClosesAt: reviewDue ? new Date(reviewDue) : null,
    }
  })
  return { scope, cycleId, positions, coverage, isLoading }
}

function Shell({
  title,
  subtitle,
  back,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  back?: React.ReactNode
  actions?: React.ReactNode
  children: (cycleId: string) => React.ReactNode
}) {
  const scope = useCycleScope()
  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        back={back}
        actions={actions}
      />
      {!scope.cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not a chief on any cycle yet" />
        )
      ) : (
        children(scope.cycleId)
      )}
    </div>
  )
}

export function ReviewsClient() {
  const { scope, cycleId, positions, coverage, isLoading } = usePositions()
  return (
    <Shell
      title="Assign reviewers"
      subtitle="Auto-assign or pick by hand, then release each opening."
      actions={cycleId && <ConflictsButton cycleId={cycleId} />}
    >
      {(id) =>
        positions.length === 0 || isLoading ? (
          <LoadingText />
        ) : (
          <AssignBoard
            cycleId={id}
            positions={positions}
            coverage={coverage}
            roleId={scope.roleId}
            setRoleId={scope.setRoleId}
          />
        )
      }
    </Shell>
  )
}

export function ConflictsButton({ cycleId }: { cycleId: string }) {
  const { data: conflicts = [] } = useReviewConflicts(cycleId)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldAlert /> Conflicts of interest
        {conflicts.length > 0 && (
          <span className="text-text-muted tabular-nums">
            {conflicts.length}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conflicts of interest</DialogTitle>
            <DialogDescription>
              Someone shouldn&apos;t judge an applicant they know personally,
              like a friend, roommate, partner or teammate. Add the pair and
              they&apos;re never assigned to review or interview that applicant,
              in any opening.
            </DialogDescription>
          </DialogHeader>
          <ConflictsEditor cycleId={cycleId} />
        </DialogContent>
      </Dialog>
    </>
  )
}

const IN_REVIEW = new Set<string>(['submitted', 'lead_review', 'chief_review'])

const released = (p: PositionState) =>
  p.reviewStatus === 'open' || p.reviewStatus === 'closed'

function AssignBoard({
  cycleId,
  positions,
  coverage,
  roleId,
  setRoleId,
}: {
  cycleId: string
  positions: PositionState[]
  coverage: number
  roleId: string
  setRoleId: (id: string) => void
}) {
  const { data: board = [], isLoading: boardLoading } = useReviewBoard(
    cycleId,
    { history: true }
  )
  // Moved on or turned down: kept for the record, no longer assignable.
  const current = (r: BoardEntry) => IN_REVIEW.has(r.stage)
  const { data: staff = [] } = useCycleStaff(cycleId)
  const { data: staffing, isLoading: staffingLoading } = useStaffing(cycleId)
  const { data: conflicts = [] } = useReviewConflicts(cycleId)
  const auto = useAutoAssign(cycleId)
  const assign = useBoardAssign(cycleId)
  const clearAll = useUnassignAllLeads()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [plan, setPlan] = useState<AutoAssignPlan | null>(null)
  const [onlyShort, setOnlyShort] = useState(false)
  const [clearing, setClearing] = useState<PositionState[] | null>(null)

  const position = positions.find((p) => p.roleId === roleId) ?? positions[0]
  const nameOf = (nuid: string) =>
    staff.find((s) => s.user_nuid === nuid)?.full_name ??
    board.flatMap((r) => r.reviewers).find((x) => x.leadNuid === nuid)?.name ??
    nuid

  const proposed = new Map<string, string[]>()
  for (const p of plan?.new ?? []) {
    proposed.set(p.application_id, [
      ...(proposed.get(p.application_id) ?? []),
      p.lead_nuid,
    ])
  }
  const added = plan?.new?.length ?? 0
  const missing = (r: BoardEntry) =>
    !current(r)
      ? 0
      : Math.max(
          0,
          coverage -
            r.reviewers.length -
            (proposed.get(r.applicationId)?.length ?? 0)
        )
  const shortIn = (id: string) =>
    board.filter((r) => r.roleId === id && missing(r) > 0).length
  const notes = (plan?.positions ?? []).flatMap((r) => {
    const name = positions.find((p) => p.roleId === r.role_id)?.name ?? ''
    return [
      ...(r.warnings ?? []).map((w) => `${name}: ${w}`),
      ...(r.short > 0
        ? [
            `${name}: ${r.short} applicant${r.short === 1 ? '' : 's'} will still be short.`,
          ]
        : []),
    ]
  })

  const load = new Map<string, { now: number; plus: number }>()
  for (const p of staffing?.positions ?? [])
    for (const n of p.reviewers ?? [])
      if (!load.has(n)) load.set(n, { now: 0, plus: 0 })
  for (const r of board) {
    for (const x of r.reviewers) {
      const cur = load.get(x.leadNuid) ?? { now: 0, plus: 0 }
      cur.now++
      load.set(x.leadNuid, cur)
    }
    for (const n of proposed.get(r.applicationId) ?? []) {
      const cur = load.get(n) ?? { now: 0, plus: 0 }
      cur.plus++
      load.set(n, cur)
    }
  }
  const loads = [...load.entries()]
    .map(([nuid, l]) => ({ nuid, name: nameOf(nuid), ...l }))
    .sort(
      (a, b) =>
        b.now + b.plus - (a.now + a.plus) || a.name.localeCompare(b.name)
    )
  const most = Math.max(1, ...loads.map((l) => l.now + l.plus))

  const rows = board.filter((r) => r.roleId === position.roleId)
  const blockedAuto = released(position)
    ? 'Reviews are already out for this opening'
    : shortIn(position.roleId) === 0
      ? 'Everyone has enough reviewers'
      : null
  const shown = onlyShort ? rows.filter((r) => missing(r) > 0) : rows
  const unsubmitted = (r: BoardEntry) =>
    r.reviewers.filter((x) => !x.submitted).length
  const clearable = positions.filter(
    (p) =>
      !released(p) &&
      board.some(
        (r) => r.roleId === p.roleId && current(r) && unsubmitted(r) > 0
      )
  )
  const clearCount = board
    .filter((r) => current(r) && clearing?.some((p) => p.roleId === r.roleId))
    .reduce((n, r) => n + unsubmitted(r), 0)

  async function run(p: Promise<unknown>) {
    try {
      await p
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function autoAssign(dryRun: boolean) {
    try {
      const result = await auto.mutateAsync({
        roleIds: [position.roleId],
        dryRun,
      })
      if (dryRun) {
        if (result.new?.length) return setPlan(result)
        const stuck = (result.positions ?? []).reduce((n, p) => n + p.short, 0)
        return toast(
          stuck
            ? `Auto-assign can't fill the last ${stuck}. Check staff groups and conflicts, or add by hand.`
            : 'Everyone already has enough reviewers.'
        )
      }
      const n = result.new?.length ?? 0
      toast(`Assigned ${n} review${n === 1 ? '' : 's'}`)
      setPlan(null)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function clear() {
    if (!clearing) return
    try {
      for (const p of clearing)
        await clearAll.mutateAsync({ cycleId, roleId: p.roleId })
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewBoard.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewerProgress.all,
      })
      toast(`Removed ${clearCount} review${clearCount === 1 ? '' : 's'}`)
      setClearing(null)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {plan ? (
        <div className="flex flex-col gap-2 border border-emerald-300 bg-emerald-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-emerald-900">
              {`Previewing ${added} new review${added === 1 ? '' : 's'} for ${position.name}. Nothing is saved yet.`}
            </span>
            <span className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPlan(null)}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={added === 0 || auto.isPending}
                onClick={() => autoAssign(false)}
              >
                Apply
              </Button>
            </span>
          </div>
          {notes.map((n) => (
            <p key={n} className="text-xs text-amber-700">
              {n}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-x-6 border-b border-gray-200 px-5">
            {positions.length > 1 && (
              <nav className="flex gap-6 overflow-x-auto">
                {positions.map((p) => {
                  const short = shortIn(p.roleId)
                  return (
                    <button
                      key={p.roleId}
                      type="button"
                      onClick={() => {
                        setRoleId(p.roleId)
                        setPlan(null)
                        setOnlyShort(false)
                      }}
                      className={cn(
                        '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors',
                        p.roleId === position.roleId
                          ? 'border-ink text-ink'
                          : 'text-text-muted hover:text-ink border-transparent'
                      )}
                    >
                      {p.name}
                      {short > 0 ? (
                        <span className="text-xs font-normal text-amber-600 tabular-nums">
                          {short} short
                        </span>
                      ) : (
                        <Check
                          size={12}
                          strokeWidth={3}
                          className="text-emerald-600"
                        />
                      )}
                    </button>
                  )
                })}
              </nav>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-2 py-2">
              {!plan && clearable.some((p) => p.roleId === position.roleId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearing([position])}
                >
                  Clear
                </Button>
              )}
              {!plan &&
                (blockedAuto ? (
                  <Tooltip label={blockedAuto}>
                    <Button size="sm" disabled>
                      <Sparkles /> Preview auto-assign
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    size="sm"
                    disabled={auto.isPending}
                    onClick={() => autoAssign(true)}
                  >
                    <Sparkles /> Preview auto-assign
                  </Button>
                ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-2">
            <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                {rows.length} applicant{rows.length === 1 ? '' : 's'}
              </span>
              {shortIn(position.roleId) > 0 &&
                shortIn(position.roleId) < rows.length && (
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={onlyShort}
                      onChange={(e) => setOnlyShort(e.target.checked)}
                      className="accent-ink h-3.5 w-3.5"
                    />
                    Only short
                  </label>
                )}
            </div>
            <ReleaseControls cycleId={cycleId} position={position} />
          </div>
          {boardLoading ? (
            <LoadingText className="px-5 py-4" />
          ) : shown.length === 0 ? (
            <p className="text-text-subtle px-5 py-6 text-center text-sm">
              {rows.length === 0
                ? 'No one is waiting on reviews.'
                : 'Everyone has enough reviewers.'}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {shown.map((r) => {
                const eligible =
                  staffing?.positions.find((p) => p.role_id === r.roleId)
                    ?.reviewers ?? []
                const taken = new Set([
                  ...r.reviewers.map((x) => x.leadNuid),
                  ...(proposed.get(r.applicationId) ?? []),
                  ...conflicts
                    .filter((c) => c.applicant_nuid === r.applicantNuid)
                    .map((c) => c.lead_nuid),
                ])
                const need = missing(r)
                const done = r.reviewers.filter((x) => x.submitted).length
                return (
                  <div
                    key={r.applicationId}
                    className="flex items-center gap-4 border-b border-gray-100 px-5 py-2 last:border-b-0"
                  >
                    <span className="text-ink w-48 shrink-0 truncate text-sm font-medium">
                      {r.name}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {r.reviewers.map((x) => (
                        <span
                          key={x.assignmentId}
                          className="group/chip text-ink flex items-center gap-1 border border-gray-200 bg-white px-2 py-0.5 text-xs"
                        >
                          {x.submitted && (
                            <Check
                              size={11}
                              strokeWidth={3}
                              className="text-emerald-600"
                            />
                          )}
                          <TruncatedName name={x.name} />
                          {!released(position) && current(r) && (
                            <button
                              type="button"
                              aria-label={`Remove ${x.name}`}
                              onClick={() =>
                                run(assign.remove.mutateAsync(x.assignmentId))
                              }
                              className="text-text-faint hover:text-ink -mr-0.5"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </span>
                      ))}
                      {(proposed.get(r.applicationId) ?? []).map((n) => (
                        <span
                          key={n}
                          className="flex items-center gap-1 border border-dashed border-emerald-400 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                        >
                          + <TruncatedName name={nameOf(n)} />
                        </span>
                      ))}
                      {!plan && need > 0 && (
                        <SearchableSelect
                          key={r.reviewers.length}
                          variant="link"
                          options={eligible
                            .filter((n) => !taken.has(n))
                            .map((n) => ({ value: n, label: nameOf(n) }))}
                          onValueChange={(leadNuid) =>
                            run(
                              assign.add.mutateAsync({
                                applicationId: r.applicationId,
                                leadNuid,
                              })
                            )
                          }
                          placeholder="+ Add"
                          searchPlaceholder="Search reviewers"
                          emptyText="Everyone's assigned"
                          className="text-text-subtle hover:text-ink border border-dashed border-gray-300 px-2 py-0.5 text-xs"
                          ariaLabel={`Add a reviewer for ${r.name}`}
                        />
                      )}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums">
                      {!current(r) ? (
                        <span className="text-text-muted">
                          {stageLabel[r.stage as ApplicationStage] ?? r.stage}
                        </span>
                      ) : released(position) ? (
                        <span className="text-text-muted">
                          {done}/{r.reviewers.length} in
                        </span>
                      ) : need > 0 ? (
                        <span className="text-amber-600">Needs {need}</span>
                      ) : (
                        <Check
                          size={13}
                          strokeWidth={3}
                          className="ml-auto text-emerald-600"
                        />
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
            <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
              Workload
            </span>
            <span className="text-text-subtle text-xs">all openings</span>
          </div>
          {boardLoading || staffingLoading ? (
            <LoadingText className="px-4 py-3" />
          ) : loads.length === 0 ? (
            <p className="text-text-subtle px-4 py-6 text-center text-sm">
              Add people on Recruitment team.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto px-4 py-3">
              {loads.map((l) => (
                <li key={l.nuid} className="flex flex-col gap-1 text-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-ink truncate">{l.name}</span>
                    <span className="shrink-0 text-xs tabular-nums">
                      <span className="text-ink">{l.now}</span>
                      {l.plus > 0 && (
                        <span className="text-emerald-700"> +{l.plus}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex h-1.5 w-full bg-gray-100">
                    <span
                      className="bg-ink block h-full"
                      style={{ width: `${(l.now / most) * 100}%` }}
                    />
                    <span
                      className="block h-full bg-emerald-400"
                      style={{ width: `${(l.plus / most) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!clearing}
        onOpenChange={(o) => !o && setClearing(null)}
        title={`Remove ${clearCount} review${clearCount === 1 ? '' : 's'}?`}
        description={
          clearing && clearing.length > 1
            ? 'Everyone who hasn’t submitted is taken off, in every opening. Submitted reviews stay.'
            : `Everyone who hasn’t submitted is taken off ${clearing?.[0]?.name ?? 'this opening'}. Submitted reviews stay.`
        }
        confirmLabel="Remove"
        pending={clearAll.isPending}
        onConfirm={clear}
      />
    </div>
  )
}

function ReviewDeadline({
  cycleId,
  position,
  label,
}: {
  cycleId: string
  position: PositionState
  label: string
}) {
  const { setDeadline: update } = useWorkflowMutations(cycleId)
  const toast = useToast()
  return (
    <DateTimePicker
      value={position.reviewClosesAt ?? undefined}
      disabled={update.isPending}
      onValueChange={(date) =>
        update
          .mutateAsync({
            roleId: position.roleId,
            step: 'reviews',
            kind: 'reviewer',
            dueAt: date.toISOString(),
          })
          .catch((err) => toast(apiErrorDetail(err), { variant: 'error' }))
      }
      trigger={
        <button
          type="button"
          className="text-text-muted hover:text-ink text-sm underline decoration-dotted underline-offset-4"
        >
          {label}
        </button>
      }
    />
  )
}

export function releaseAction(p: PositionState, now = new Date()) {
  if (!p.hasRubric) return 'write-form'
  const due = p.reviewClosesAt
  if (p.reviewStatus === 'open' || p.reviewStatus === 'closed') {
    return p.reviewStatus === 'closed' || (due && due < now)
      ? 'closed'
      : 'reviewing'
  }
  if (!p.closed) return 'waiting'
  if (p.assigned === 0) return 'assign-first'
  if (!due || due < now) return 'needs-date'
  return 'release'
}

function ReleaseControls({
  cycleId,
  position: p,
}: {
  cycleId: string
  position: PositionState
}) {
  const toCycle = useCycleHref()
  const { release: update } = useWorkflowMutations(cycleId)
  const toast = useToast()
  const step = releaseAction(p)
  const due = p.reviewClosesAt
  const [confirm, setConfirm] = useState(false)

  async function release() {
    try {
      await update.mutateAsync({
        roleId: p.roleId,
        step: 'reviews',
        released: true,
      })
      setConfirm(false)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  if (step === 'write-form')
    return (
      <Link
        href={toCycle('/cycle/review-forms')}
        className="text-ink flex items-center gap-1 text-sm font-medium hover:underline"
      >
        Write the review form <ArrowRight size={14} />
      </Link>
    )
  if (step === 'waiting')
    return (
      <span className="text-text-subtle text-sm">
        Release opens{' '}
        {p.closesAt ? formatDeadline(p.closesAt) : 'at the deadline'}
      </span>
    )
  if (step === 'reviewing')
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-emerald-500" />
        <span className="text-ink">Reviews open</span>
        <ReviewDeadline
          cycleId={cycleId}
          position={p}
          label={`closes ${due ? formatDeadline(due) : ''}`}
        />
      </span>
    )
  if (step === 'closed')
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="bg-ink size-2 rounded-full" />
        <span className="text-ink">Reviews closed</span>
        <ReviewDeadline cycleId={cycleId} position={p} label="Extend" />
      </span>
    )
  const blocked =
    step === 'assign-first'
      ? 'Assign reviewers first'
      : step === 'needs-date'
        ? 'Set a due date first'
        : null
  return (
    <span className="flex items-center gap-3">
      <ReviewDeadline
        cycleId={cycleId}
        position={p}
        label={due ? `Due ${formatDeadline(due)}` : 'Set due date'}
      />
      {blocked ? (
        <Tooltip label={blocked}>
          <Button size="sm" disabled>
            Release reviews
          </Button>
        </Tooltip>
      ) : (
        <Button
          size="sm"
          disabled={update.isPending}
          onClick={() => setConfirm(true)}
        >
          Release reviews
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Release reviews for ${p.name}?`}
        description="Reviewers can start scoring. After this you can’t remove reviewers or clear the opening. Reviews close on their own at the due date."
        confirmLabel="Release"
        pending={update.isPending}
        onConfirm={release}
      />
    </span>
  )
}
