'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { StatusDot } from '@/components/ui/badge'
import { Tooltip } from '@/components/Tooltip'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DeadlinePicker } from '@/components/ui/deadline-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { useToast } from '@/components/ui/toast'
import { useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import type { ApplicationTemplate } from '@/lib/api/types'
import {
  useApplicationTemplate,
  useApplicationTemplatesByCycleRoles,
} from '@/lib/queries/application-templates'
import { useCycleTemplateSummary } from '@/lib/queries/cycles'
import { useSetOpeningStep } from '@/lib/queries/workflow'
import type { CycleStatus } from '@/lib/api/types'
import {
  cycleStatusDot,
  cycleStatusLabel,
} from '../../../../admin/applications/components/constants'
import { cn } from '@/lib/utils'
import { FormStatusBadge } from '../../components/FormStatusBadge'

type Status = ApplicationTemplate['status']

export function releaseBlocker(hasForm: boolean, hasDeadline: boolean) {
  if (!hasForm && !hasDeadline) return 'Write the form and set a deadline first'
  if (!hasForm) return 'Write the application form first'
  if (!hasDeadline) return 'Set a deadline first'
  return undefined
}

const ROW =
  'grid items-center gap-3 px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem] md:gap-4'

const NEXT_ACTION: Record<Status, { label: string; to: Status } | null> = {
  draft: { label: 'Release', to: 'open' },
  open: { label: 'Close now', to: 'closed' },
  closed: { label: 'Reopen', to: 'open' },
  archived: null,
}

export function ApplicationHubClient() {
  const scope = useCycleScope()
  const { data: summaries = [] } = useCycleTemplateSummary(scope.cycleId)
  const summary = (roleId: string) =>
    summaries.find((s) => s.role_id === roleId)
  const roleIds = scope.roles.roleIds
  const templates = useApplicationTemplatesByCycleRoles(
    roleIds.map((roleId) => ({ cycleId: scope.cycleId, roleId }))
  )
  const drafts = roleIds.filter(
    (_, i) => templates[i]?.data?.status === 'draft'
  )
  const releasable = drafts.filter(
    (r) =>
      (summary(r)?.question_count ?? 0) > 0 &&
      !!templates[roleIds.indexOf(r)]?.data?.closes_at
  )
  const setStep = useSetOpeningStep()
  const toast = useToast()

  async function releaseAll() {
    try {
      for (const roleId of releasable) {
        await setStep.mutateAsync({
          cycleId: scope.cycleId,
          roleId,
          step: 'applications',
          status: 'open',
        })
      }
      toast(
        `Released ${releasable.length} position${releasable.length === 1 ? '' : 's'}`
      )
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Application forms"
        subtitle="Write each position's application, set when it closes, then release it."
        actions={
          drafts.length > 1 &&
          releasable.length > 0 && (
            <Button
              variant="brutal-ink"
              disabled={setStep.isPending}
              title={
                releasable.length < drafts.length
                  ? `${drafts.length - releasable.length} still need a form or deadline`
                  : undefined
              }
              onClick={releaseAll}
            >
              Release all
              {releasable.length < drafts.length &&
                releasable.length > 0 &&
                ` (${releasable.length})`}
            </Button>
          )
        }
      />
      {!scope.cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not a chief on any cycle yet" />
        )
      ) : scope.roles.roleIds.length === 0 ? (
        <EmptyState
          title="Add a position first"
          action={
            <Button variant="outline" asChild>
              <Link href="/reviewer/cycle/workflow">Openings & process</Link>
            </Button>
          }
        />
      ) : (
        <Card padding="none">
          <div
            className={cn(
              ROW,
              'font-display text-text-subtle hidden border-b border-gray-100 py-2 text-[11px] tracking-wider uppercase md:grid'
            )}
          >
            <span>Position</span>
            <span>Application form</span>
            <span>Closes</span>
            <span />
          </div>
          {roleIds.map((roleId) => (
            <PositionRelease
              key={roleId}
              cycleId={scope.cycleId}
              roleId={roleId}
              roleName={scope.roles.roleLabel(roleId)}
              questions={summary(roleId)?.question_count ?? 0}
              applicants={summary(roleId)?.submission_count ?? 0}
            />
          ))}
          {templates.some((t) => t.data?.status === 'closed') && (
            <Link
              href="/reviewer/cycle/reviews"
              className="text-ink flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm font-medium hover:bg-gray-50"
            >
              Applications closed. Assign reviewers
              <ArrowRight size={14} />
            </Link>
          )}
        </Card>
      )}
    </div>
  )
}

function PositionRelease({
  cycleId,
  roleId,
  roleName,
  questions,
  applicants,
}: {
  cycleId: string
  roleId: string
  roleName: string
  questions: number
  applicants: number
}) {
  const { data: template } = useApplicationTemplate(cycleId, roleId)
  const setStep = useSetOpeningStep()
  const { cycle } = useCycleScope()
  const toast = useToast()
  const status = template?.status
  const action = status ? NEXT_ACTION[status] : null
  const missing = releaseBlocker(questions > 0, !!template?.closes_at)
  const blocked = action?.to === 'open' && !!missing
  const router = useRouter()

  async function save(change: { status?: CycleStatus; dueAt?: string }) {
    try {
      await setStep.mutateAsync({
        cycleId,
        roleId,
        step: 'applications',
        ...change,
      })
      if (change.status === 'open' && cycle?.status === 'draft') {
        toast(`${cycle.name} is now open to applicants`)
      } else if (change.status === 'open') {
        toast(`${roleName} applications open`)
      } else if (change.status === 'closed') {
        toast(`${roleName} applications closed`)
      }
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  const formHref = `/admin/applications/${cycleId}/${roleId}/builder?from=forms`
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(formHref)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(formHref)
      }}
      className={cn(
        ROW,
        'cursor-pointer border-b border-gray-100 py-3 transition-colors last:border-b-0 hover:bg-gray-50'
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-ink truncate font-semibold">{roleName}</span>
          <FormStatusBadge written={questions > 0} />
        </div>
        {status && (
          <div className="text-text-muted flex items-center gap-1.5 text-xs">
            <StatusDot className={cycleStatusDot[status]} />
            {cycleStatusLabel[status]}
            {status !== 'draft' && ` · ${applicants} applied`}
          </div>
        )}
      </div>

      <span
        className={cn(
          'text-sm',
          questions > 0 ? 'text-ink' : 'text-text-subtle'
        )}
      >
        {questions > 0
          ? `${questions} question${questions === 1 ? '' : 's'}`
          : 'Not written'}
      </span>

      <div onClick={stop} onKeyDown={stop}>
        <DeadlinePicker
          value={template?.closes_at}
          onValueChange={(date) => save({ dueAt: date.toISOString() })}
          disabled={!template}
          lockedReason={
            template?.review_status === 'open' ||
            template?.review_status === 'closed'
              ? "Reviews have started, so the deadline can't move."
              : undefined
          }
        />
      </div>

      <div className="flex justify-end" onClick={stop} onKeyDown={stop}>
        {action && blocked && missing ? (
          <Tooltip label={missing}>
            <Button size="sm" variant="outline" disabled>
              {action.label}
            </Button>
          </Tooltip>
        ) : (
          action && (
            <Button
              size="sm"
              variant={action.to === 'open' ? 'default' : 'outline'}
              disabled={!template || setStep.isPending}
              onClick={() => save({ status: action.to })}
            >
              {action.label}
            </Button>
          )
        )}
      </div>
    </div>
  )
}
