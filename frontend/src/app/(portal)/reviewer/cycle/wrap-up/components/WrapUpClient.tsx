'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { useToast } from '@/components/ui/toast'
import { useChiefPhases } from '@/components/nav/ChiefCycleNav'
import { apiErrorDetail } from '@/lib/api/client'
import { cycleAudience } from '@/lib/cycle-type'
import { useMutation } from '@tanstack/react-query'
import { closeCycle as closeCycleApi } from '@/generated/workflow/workflow'
import { useWorkflowMutations, type StepName } from '@/lib/queries/workflow'

const CHECKLIST: Record<string, string[]> = {
  applications: [
    'The application form is released and its deadline has passed',
    'Late applicants are handled (extend the deadline first if needed)',
  ],
  reviews: [
    'Every lead has submitted their reviews (check Progress)',
    'The shortlist is set and advanced to interviews',
  ],
  interviews: [
    'Every interview is written up',
    'Every recording review is in',
    'Applicants going on are moved to the next stage',
  ],
  decisions: ['Preference lists are final', 'The draft is finished and ended'],
}

export function WrapUpClient() {
  const stageKey = useSearchParams().get('stage') ?? ''
  const router = useRouter()
  const toast = useToast()
  const { scope, phases } = useChiefPhases()
  const { complete: update } = useWorkflowMutations(scope.cycleId)

  const index = phases.findIndex((p) => p.key === stageKey)
  const phase = phases[index]
  const next = phases.slice(index + 1).find(() => true)
  const updateCycle = useMutation({
    mutationFn: (id: string) => closeCycleApi(id),
  })
  const [confirmClose, setConfirmClose] = useState(false)
  const finished = !next && phases.every((p) => p.status === 'done')
  const cycleName = scope.cycle
    ? `${scope.cycle.name} · ${cycleAudience(scope.cycle.application_type)}`
    : ''

  async function closeCycle() {
    try {
      await updateCycle.mutateAsync(scope.cycleId)
      toast(`${cycleName} closed`)
      router.push('/reviewer/cycle/workflow')
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function complete() {
    if (!phase || phase.key === 'setup') return
    try {
      await update.mutateAsync(phase.key as StepName)
      if (next) router.push(next.steps[0]?.href ?? '/reviewer/cycle/workflow')
      else toast('Stage done')
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  if (scope.isLoading) {
    return (
      <div className={PAGE_SHELL}>
        <LoadingText />
      </div>
    )
  }
  if (!phase) {
    return (
      <div className={PAGE_SHELL}>
        <EmptyState title="This stage isn't part of the cycle's workflow" />
      </div>
    )
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title={`Wrap up: ${phase.label}`}
        subtitle={`${scope.branch?.name ?? ''} · ${scope.cycle?.name ?? ''}`}
        actions={
          <Badge>
            {phase.status === 'done'
              ? 'Done'
              : phase.status === 'current'
                ? 'In progress'
                : 'Locked'}
          </Badge>
        }
      />

      <Card className="flex flex-col gap-4">
        <div className="text-sm">
          <span className="text-ink font-semibold">{phase.count}</span>{' '}
          <span className="text-text-muted">
            applicant{phase.count === 1 ? '' : 's'} still in this stage
          </span>
        </div>
        {(CHECKLIST[phase.key] ?? []).length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {CHECKLIST[phase.key].map((item) => (
              <li
                key={item}
                className="text-text-default flex items-start gap-2"
              >
                <Check size={14} className="text-text-faint mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {phase.steps
            .filter((s) => !s.href.includes('wrap-up'))
            .map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-ink inline-flex items-center gap-1 border border-gray-200 px-2.5 py-1 text-sm hover:bg-gray-50"
              >
                {s.label} <ArrowRight size={12} />
              </Link>
            ))}
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        {phase.status === 'locked' ? (
          <span className="text-text-muted flex items-center gap-2 text-sm">
            <Lock size={14} /> Finish the earlier stages first.
          </span>
        ) : finished ? (
          <>
            <span className="text-text-muted text-sm">
              Every stage is done.
            </span>
            <div className="flex gap-2">
              <Button
                variant="brutal-ink"
                onClick={() => setConfirmClose(true)}
              >
                Close recruitment
              </Button>
            </div>
          </>
        ) : phase.status === 'done' ? (
          <>
            <span className="text-text-muted text-sm">
              This stage is done{next ? ` — ${next.label} is open.` : '.'}
            </span>
          </>
        ) : (
          <>
            <span className="text-text-muted text-sm">
              {next
                ? `Marking this done opens ${next.label}.`
                : 'Last stage. Once it’s done you can close the recruitment.'}
            </span>
            <Button
              variant="brutal-ink"
              disabled={update.isPending}
              onClick={() => complete()}
            >
              Mark done{next ? ` & go to ${next.label}` : ''}
            </Button>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close ${cycleName}?`}
        description="It will disappear from your sidebar. Only an admin can reopen it."
        confirmLabel="Close recruitment"
        pending={updateCycle.isPending}
        onConfirm={closeCycle}
      />
    </div>
  )
}
