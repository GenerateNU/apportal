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
import type { Role } from '@/lib/api/types'
import {
  useCommitInterviewerPlan,
  useInterviewerPool,
  usePreviewInterviewerPlan,
  useSuggestInterviewerCapacity,
} from '@/lib/queries/interview-assignment-plan'
import { ROLE_LABEL } from '@/lib/roles'
import type { DraftLeadDay } from './MeetingDayPicker'
import { InterviewerPlanPreview } from './InterviewerPlanPreview'

export function InterviewerPlanPanel({
  cycleId,
  role,
  meetingDays,
}: {
  cycleId: string
  role: Role
  meetingDays: DraftLeadDay[]
}) {
  const [cap, setCap] = useState(10)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [excludeListOpen, setExcludeListOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const { data: pool } = useInterviewerPool(cycleId, role)
  const suggestCapacity = useSuggestInterviewerCapacity()
  const preview = usePreviewInterviewerPlan()
  const commit = useCommitInterviewerPlan()

  const apiLeads = useMemo(
    () => meetingDays.map((d) => ({ lead_nuid: d.leadNuid, day: d.day })),
    [meetingDays]
  )
  const canPlan = apiLeads.length > 0 && !!cycleId

  const excludedApplicationIds = useMemo(() => [...excludedIds], [excludedIds])
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

  function resetResults() {
    suggestCapacity.reset()
    preview.reset()
    commit.reset()
  }

  function onSuggest() {
    preview.reset()
    suggestCapacity.mutate(
      {
        cycleId,
        body: {
          role,
          leads: apiLeads,
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
        leads: apiLeads,
        cap,
        excluded_application_ids: excludedApplicationIds,
      },
    })
  }

  function onCommit() {
    commit.mutate(
      {
        cycleId,
        body: {
          role,
          leads: apiLeads,
          cap,
          excluded_application_ids: excludedApplicationIds,
        },
      },
      { onSuccess: () => setConfirming(false) }
    )
  }

  const capacity = suggestCapacity.data
  const shownPlan = commit.data?.plan ?? preview.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col">
          <span className="text-text-faint text-xs">
            Awaiting an interviewer
          </span>
          <span className="text-text-default text-sm font-semibold">
            {poolAppliedSize ?? '—'} {ROLE_LABEL[role].toLowerCase()} applicant
            {poolAppliedSize === 1 ? '' : 's'}
          </span>
          {excludedIds.size > 0 && (
            <span className="text-text-faint text-xs">
              {excludedIds.size} excluded
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-text-faint text-xs">Leads with a day set</span>
          <span className="text-text-default text-sm font-semibold">
            {meetingDays.length}
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

      <section className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <h2 className="text-text-default text-sm font-semibold">Sizing</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interviewer-cap" className="text-xs">
              Max interviews per lead
            </Label>
            <Input
              id="interviewer-cap"
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
            Could not size the cap: {errorMessage(suggestCapacity.error)}
          </p>
        )}

        {capacity && (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap gap-5">
              <Figure label="Minimum cap" value={capacity.min_cap} />
              <Figure label="Suggested cap" value={capacity.suggested_cap} />
              <Figure
                label="Interviews needed"
                value={capacity.required_slots}
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
          <InterviewerPlanPreview plan={shownPlan} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex flex-col">
              <span className="text-text-default text-sm font-medium">
                Ready to assign
              </span>
              <span className="text-text-muted text-xs">
                Creates up to {shownPlan.total_added} interviewer assignment
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
                Assign interviewers
              </Button>
            </div>
          </div>

          {commit.isError && (
            <p className="text-destructive text-sm">
              Could not assign interviewers: {errorMessage(commit.error)}
            </p>
          )}
        </>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign interviewers?</DialogTitle>
            <DialogDescription>
              This writes up to {shownPlan?.total_added ?? 0} interviewer
              assignment{shownPlan?.total_added === 1 ? '' : 's'} for{' '}
              {ROLE_LABEL[role].toLowerCase()} applicants. Existing assignments
              are left untouched, and running this again later only fills gaps.
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
              Assign interviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
