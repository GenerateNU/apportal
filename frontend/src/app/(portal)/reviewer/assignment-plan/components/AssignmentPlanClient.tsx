'use client'

import { useMemo, useState } from 'react'
import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/api/types'
import {
  useAssignmentPool,
  useCommitAssignmentPlan,
  usePreviewAssignmentPlan,
  useSuggestCapacity,
} from '@/lib/queries/assignment-plan'
import { useCycles } from '@/lib/queries/cycles'
import { useLeads } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { PlanPreview } from './PlanPreview'
import { TeamBuilder, type DraftTeam } from './TeamBuilder'

// Teams live in component state rather than the database — a chief regroups
// leads per run, so they are request input rather than stored state. Sizing and
// preview are read-only; only "Assign reviewers" writes, and even then existing
// assignments are never removed or reassigned.

export function AssignmentPlanClient() {
  const { data: cycles = [] } = useCycles({})
  const { data: leads = [] } = useLeads()

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    setCycleId((cycles.find((c) => c.status === 'open') ?? cycles[0]).id)
  }
  const [role, setRole] = useState<Role>('software_engineer')
  const [teams, setTeams] = useState<DraftTeam[]>([])
  const [coverage, setCoverage] = useState(2)
  const [cap, setCap] = useState(20)
  // Which applicants to leave out of this planning run — request input, same
  // as teams, not stored server-side. Reset whenever the pool itself changes.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [excludeListOpen, setExcludeListOpen] = useState(false)

  const { data: pool } = useAssignmentPool(cycleId, role)
  const suggestCapacity = useSuggestCapacity()
  const preview = usePreviewAssignmentPlan()
  const commit = useCommitAssignmentPlan()
  const [confirming, setConfirming] = useState(false)

  const excludedApplicationIds = useMemo(() => [...excludedIds], [excludedIds])
  // pool.pool_size ignores exclusions (the backend doesn't know about them
  // until a planning call is made), so the displayed count is adjusted here.
  const poolAppliedSize = pool
    ? pool.applicants.length - excludedIds.size
    : undefined

  function toggleExcluded(applicationId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
    resetResults()
  }

  // Only teams with at least one lead are meaningful to the planner; an empty
  // team is a half-finished edit, not an input.
  const readyTeams = useMemo(
    () => teams.filter((t) => t.leadNuids.length > 0),
    [teams]
  )
  const canPlan = readyTeams.length > 0 && !!cycleId

  const apiTeams = useMemo(
    () =>
      readyTeams.map((t, i) => ({
        name: t.name.trim() || `Team ${i + 1}`,
        lead_nuids: t.leadNuids,
      })),
    [readyTeams]
  )

  // Changing the inputs invalidates whatever is on screen, so clear both
  // results rather than leaving a stale plan that no longer matches the form.
  function resetResults() {
    suggestCapacity.reset()
    preview.reset()
    commit.reset()
  }

  function onCommit() {
    commit.mutate(
      {
        cycleId,
        body: {
          role,
          teams: apiTeams,
          coverage,
          cap,
          excluded_application_ids: excludedApplicationIds,
        },
      },
      { onSuccess: () => setConfirming(false) }
    )
  }

  function onSuggest() {
    preview.reset()
    suggestCapacity.mutate(
      {
        cycleId,
        body: {
          role,
          teams: apiTeams,
          coverage,
          excluded_application_ids: excludedApplicationIds,
        },
      },
      { onSuccess: (data) => setCap(data.suggested_cap || cap) }
    )
  }

  function onPreview() {
    preview.mutate({
      cycleId,
      body: {
        role,
        teams: apiTeams,
        coverage,
        cap,
        excluded_application_ids: excludedApplicationIds,
      },
    })
  }

  const capacity = suggestCapacity.data

  // Commit re-plans server-side and returns the result as written, so once it
  // succeeds that becomes the plan on screen — otherwise every row would still
  // read as "to be added" after the work was already done.
  const shownPlan = commit.data?.plan ?? preview.data

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Plan assignments
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Group leads into teams, size the review cap, then preview who
            reviews what before assigning.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={role}
            onValueChange={(val) => {
              setRole(val as Role)
              setExcludedIds(new Set())
              resetResults()
            }}
          >
            <SelectTrigger className="w-56" aria-label="Applicant role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cycleId}
            onValueChange={(val) => {
              setCycleId(val)
              setExcludedIds(new Set())
              resetResults()
            }}
          >
            <SelectTrigger className="w-40" aria-label="Cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col">
          <span className="text-text-faint text-xs">Awaiting review</span>
          <span className="text-text-default text-sm font-semibold">
            {poolAppliedSize ?? '—'} {ROLE_LABEL[role].toLowerCase()}{' '}
            application
            {poolAppliedSize === 1 ? '' : 's'}
          </span>
          {excludedIds.size > 0 && (
            <span className="text-text-faint text-xs">
              {excludedIds.size} excluded
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-text-faint text-xs">Leads available</span>
          <span className="text-text-default text-sm font-semibold">
            {pool?.lead_count ?? leads.length}
          </span>
        </div>
      </div>

      {pool && pool.applicants.length > 0 && (
        <section className="rounded-xl border border-gray-100 bg-white p-4">
          <button
            type="button"
            className="text-text-default flex w-full items-center gap-2 text-sm font-semibold"
            onClick={() => setExcludeListOpen((open) => !open)}
          >
            {excludeListOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            Exclude applicants
            <span className="text-text-faint font-normal">
              ({excludedIds.size} of {pool.applicants.length} excluded)
            </span>
          </button>
          {excludeListOpen && (
            <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {pool.applicants.map((applicant) => {
                const excluded = excludedIds.has(applicant.application_id)
                return (
                  <label
                    key={applicant.application_id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={excluded}
                      onChange={() => toggleExcluded(applicant.application_id)}
                    />
                    <span
                      className={`text-sm ${excluded ? 'text-text-faint line-through' : 'text-text-default'}`}
                    >
                      {applicant.full_name}
                    </span>
                    <span className="text-text-faint text-xs">
                      {applicant.email}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </section>
      )}

      <TeamBuilder
        teams={teams}
        leads={leads}
        onChange={(next) => {
          setTeams(next)
          resetResults()
        }}
      />

      {/* Sizing */}
      <section className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <h2 className="text-text-default text-sm font-semibold">Sizing</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverage" className="text-xs">
              Reviewers per application
            </Label>
            <Input
              id="coverage"
              type="number"
              min={1}
              value={coverage}
              className="h-9 w-40"
              onChange={(e) => {
                setCoverage(Math.max(1, Number(e.target.value) || 1))
                resetResults()
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap" className="text-xs">
              Max applications per lead
            </Label>
            <Input
              id="cap"
              type="number"
              min={1}
              value={cap}
              className="h-9 w-40"
              onChange={(e) => {
                setCap(Math.max(1, Number(e.target.value) || 1))
                preview.reset()
              }}
            />
          </div>
          <Button
            variant="outline"
            onClick={onSuggest}
            disabled={!canPlan || suggestCapacity.isPending}
          >
            {suggestCapacity.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Calculator size={14} />
            )}
            Suggest a cap
          </Button>
          <Button onClick={onPreview} disabled={!canPlan || preview.isPending}>
            {preview.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            Generate preview
          </Button>
        </div>

        {suggestCapacity.isError && (
          <p className="text-destructive text-xs">
            Could not size the cap: {String(suggestCapacity.error)}
          </p>
        )}

        {capacity && (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap gap-5">
              <Figure label="Minimum cap" value={capacity.min_cap} />
              <Figure label="Suggested cap" value={capacity.suggested_cap} />
              <Figure label="Even split" value={capacity.even_split} />
              <Figure label="Reviews needed" value={capacity.required_slots} />
              <Figure
                label="Deepest possible coverage"
                value={`${capacity.max_coverage} per app`}
              />
            </div>
            {(capacity.notes ?? []).map((note) => (
              <p key={note} className="text-text-muted text-xs">
                {note}
              </p>
            ))}
          </div>
        )}
      </section>

      {preview.isError && (
        <p className="text-destructive text-sm">
          Could not build a preview: {errorMessage(preview.error)}
        </p>
      )}

      {shownPlan && (
        <>
          <PlanPreview plan={shownPlan} />

          {/* Commit bar. The preview above is what gets written, but the server
              re-plans at commit time, so the count is described as "up to". */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex flex-col">
              <span className="text-text-default text-sm font-medium">
                Ready to assign
              </span>
              <span className="text-text-muted text-xs">
                Creates up to {shownPlan.total_added} assignment
                {shownPlan.total_added === 1 ? '' : 's'}. Existing assignments
                are kept as they are.
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {commit.isSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={14} />
                  {commit.data.created} assignment
                  {commit.data.created === 1 ? '' : 's'} created
                </span>
              )}
              <Button
                onClick={() => setConfirming(true)}
                disabled={shownPlan.total_added === 0 || commit.isPending}
              >
                {commit.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <UserPlus size={14} />
                )}
                Assign reviewers
              </Button>
            </div>
          </div>

          {commit.isError && (
            <p className="text-destructive text-sm">
              Could not assign reviewers: {errorMessage(commit.error)}
            </p>
          )}
        </>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign reviewers?</DialogTitle>
            <DialogDescription>
              This writes up to {shownPlan?.total_added ?? 0} lead assignment
              {shownPlan?.total_added === 1 ? '' : 's'} for{' '}
              {ROLE_LABEL[role].toLowerCase()} applicants. Existing assignments
              are left untouched, and running this again later only fills gaps —
              but assignments are not removed by re-running, so unassign from
              the Assign Reviewers page if you need to undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={onCommit} disabled={commit.isPending}>
              {commit.isPending && (
                <Loader2 className="animate-spin" size={14} />
              )}
              Assign reviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

// Surfaces the backend's message (Huma returns a `detail` field) instead of
// stringifying the whole error object, which reads as "APIError: Not Found".
function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail
  if (detail) return detail
  return error instanceof Error ? error.message : String(error)
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-faint text-xs">{label}</span>
      <span className="text-text-default text-sm font-semibold">{value}</span>
    </div>
  )
}
