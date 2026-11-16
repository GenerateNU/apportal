'use client'

import { useIsChief } from '@/lib/queries/cycle-staff'
import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_L, PAGE_R, PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { ApplicantOverview } from '@/app/(portal)/reviewer/applications/components/ApplicantOverview'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { useDecisions, useDecisionTemplates } from '@/lib/queries/decisions'
import { useCycleRoles, useRoleLookup } from '@/lib/queries/roles'
import { useCurrentUser } from '@/lib/queries/users'
import { cn, formatDate } from '@/lib/utils'
import {
  stageBadge,
  stageLabel,
} from '@/app/(portal)/reviewer/applications/components/constants'
import { REVIEW_STATE_BADGE } from '../../../my-reviews/constants'
import { FeedbackFields } from '../../components/FeedbackFields'
import { MessagePreview } from '../../components/MessagePreview'
import { feedbackState } from '../../components/constants'
import { renderDecision } from '../../components/render'
import { useFeedbackDraft } from '../../components/useFeedbackDraft'

const SHELL = cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)

export function DecisionDraftClient({
  applicationId,
  cycleId,
  role,
}: {
  applicationId: string
  cycleId: string
  role: string
}) {
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useStaffCycles()
  const { data: rows = [], isLoading } = useDecisions(cycleId)
  const { roleIds } = useCycleRoles(cycleId)
  const { data: templates = [] } = useDecisionTemplates(cycleId, role)

  const isChief = useIsChief()
  const row = rows.find((r) => r.application_id === applicationId)

  const queue = useMemo(
    () =>
      roleIds.flatMap((r) =>
        rows
          .filter((x) => x.role_id === r)
          .filter(
            (x) =>
              x.application_id === applicationId ||
              isChief ||
              (x.kind === 'rejection_post_interview' &&
                x.interviewers.some((iv) => iv.nuid === currentUser?.nuid))
          )
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      ),
    [rows, roleIds, isChief, currentUser?.nuid, applicationId]
  )
  const index = queue.findIndex((r) => r.application_id === applicationId)
  const previous = index > 0 ? queue[index - 1] : undefined
  const next =
    index >= 0 && index < queue.length - 1 ? queue[index + 1] : undefined
  const written = queue.filter((r) => feedbackState(r) === 'submitted').length

  if (isLoading) {
    return (
      <div className={SHELL}>
        <LoadingText />
      </div>
    )
  }

  if (!row) {
    return (
      <div className={SHELL}>
        <PageHeader back={<Crumbs />} title="Feedback" />
        <EmptyState
          title="Not in your feedback queue"
          description="Either they aren't awaiting a message, or you didn't interview them."
        />
      </div>
    )
  }

  return (
    <DraftBody
      key={row.application_id}
      row={row}
      cycleId={cycleId}
      cycleName={cycles.find((c) => c.id === cycleId)?.name ?? ''}
      template={templates.find((t) => t.kind === row.kind)}
      canWrite={
        isChief ||
        (!row.sent_at &&
          row.interviewers.some((iv) => iv.nuid === currentUser?.nuid))
      }
      previousHref={
        previous ? `/reviewer/decisions/${previous.application_id}` : undefined
      }
      nextHref={next ? `/reviewer/decisions/${next.application_id}` : undefined}
      position={
        index >= 0 ? { index, total: queue.length, written } : undefined
      }
    />
  )
}

function DraftBody({
  row,
  cycleId,
  cycleName,
  template,
  canWrite,
  previousHref,
  nextHref,
  position,
}: {
  row: DecisionRow
  cycleId: string
  cycleName: string
  template?: DecisionTemplate
  canWrite: boolean
  previousHref?: string
  nextHref?: string
  position?: { index: number; total: number; written: number }
}) {
  const { roleLabel, roleChipClass } = useRoleLookup()
  const draft = useFeedbackDraft(row, cycleId, canWrite)
  const rendered = renderDecision(
    { ...row, feedback: draft.feedback, compliments: draft.compliments },
    template,
    cycleName,
    roleLabel(row.role_id)
  )

  const filled = [draft.feedback.trim(), draft.compliments.trim()].filter(
    Boolean
  ).length
  const status = row.sent_at
    ? {
        label: `Sent ${formatDate(row.sent_at)}`,
        className: REVIEW_STATE_BADGE.submitted,
      }
    : filled === 2 || row.status === 'ready'
      ? { label: 'Ready to send', className: REVIEW_STATE_BADGE.submitted }
      : filled === 1
        ? { label: 'In progress', className: 'bg-chip-9-bg text-chip-9-text' }
        : { label: 'Not written', className: REVIEW_STATE_BADGE.none }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <div className={cn('bg-white pb-6', PAGE_X, PAGE_TOP)}>
        <PageHeader
          back={<Crumbs name={row.full_name} />}
          title={row.full_name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Badge className={roleChipClass(row.role_id)}>
                {roleLabel(row.role_id)}
              </Badge>
              <Badge className={stageBadge[row.stage]}>
                {stageLabel[row.stage]}
              </Badge>
              <Badge className={status.className}>
                Feedback: {status.label}
              </Badge>
            </span>
          }
          actions={
            <>
              {position && (
                <span className="font-display text-text-subtle mr-3 text-[11px] tracking-wider uppercase">
                  Feedback {position.index + 1} of {position.total} ·{' '}
                  {position.written} written
                </span>
              )}
              {previousHref && (
                <Button asChild variant="outline" size="sm">
                  <Link href={previousHref}>
                    <ChevronLeft data-icon="inline-start" size={14} />
                    Previous
                  </Link>
                </Button>
              )}
              {nextHref && (
                <Button asChild variant="outline" size="sm">
                  <Link href={nextHref}>
                    Next
                    <ArrowRight data-icon="inline-end" size={14} />
                  </Link>
                </Button>
              )}
            </>
          }
        />
      </div>

      <ResizableSplit
        storageKey="feedback-split"
        className="min-h-0 flex-1 lg:overflow-hidden"
        left={
          <div
            className={cn(
              'border-b border-gray-200 py-6 lg:overflow-y-auto lg:border-b-0',
              PAGE_L,
              'pr-6 sm:pr-8'
            )}
          >
            <ApplicantOverview
              applicationId={row.application_id}
              cycleId={row.cycle_id}
              role={row.role_id}
              applicantNuid={row.applicant_nuid}
              stage={row.stage}
              hideHeader
            />
          </div>
        }
        right={
          <div
            className={cn(
              'flex flex-col gap-6 py-6 pl-6 sm:pl-8 lg:overflow-y-auto',
              PAGE_R
            )}
          >
            {row.sent_at && (
              <p className="text-text-muted flex items-center gap-2 border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <Lock size={14} className="shrink-0" />
                Sent {formatDate(row.sent_at)}. This letter can&apos;t be
                changed.
              </p>
            )}
            <FeedbackFields
              row={row}
              feedback={draft.feedback}
              compliments={draft.compliments}
              onFeedbackChange={draft.setFeedback}
              onComplimentsChange={draft.setCompliments}
              canWrite={canWrite}
              saving={draft.saving}
            />
            <MessagePreview
              rendered={rendered}
              email={row.email}
              copyKeyPrefix={row.application_id}
              overridden={!!row.body_override}
            />
          </div>
        }
      />
    </div>
  )
}

function Crumbs({ name }: { name?: string }) {
  const isChief = useIsChief()
  const current = { label: name ?? 'Applicant' }
  return (
    <Breadcrumbs
      items={
        isChief
          ? [
              { label: 'Decision feedback', href: '/reviewer/decisions' },
              current,
            ]
          : [
              { label: 'Feedback', href: '/reviewer/my-work?phase=feedback' },
              current,
            ]
      }
    />
  )
}
