'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Badge } from '@/components/ui/badge'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_L, PAGE_R, PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type {
  DecisionContext,
  DecisionRow,
  DecisionTemplate,
  ReviewQuestion,
} from '@/lib/api/types'
import { useCycles } from '@/lib/queries/cycles'
import { useDecisionContext, useDecisions } from '@/lib/queries/decisions'
import { useDecisionTemplates } from '@/lib/queries/decisions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import { DecisionContextPanel } from '../../components/DecisionContextPanel'
import { FeedbackFields } from '../../components/FeedbackFields'
import { MessagePreview } from '../../components/MessagePreview'
import { feedbackState } from '../../components/constants'
import { renderDecision } from '../../components/render'
import { useFeedbackDraft } from '../../components/useFeedbackDraft'
import { useCycleRoles } from '@/lib/queries/roles'
import { useRoleLookup } from '@/lib/queries/roles'

// One applicant: everything already said about them on the left, the two
// paragraphs and the letter they land in on the right. Same shape as the lead
// review and interview write-up screens, with next/back walking the queue.
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
  const { data: cycles = [] } = useCycles({})
  const { data: rows = [], isLoading } = useDecisions(cycleId)
  const { roleIds } = useCycleRoles(cycleId)
  const { data: templates = [] } = useDecisionTemplates(cycleId, role)
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: contextById = {}, isLoading: contextLoading } =
    useDecisionContext([applicationId])

  const row = rows.find((r) => r.application_id === applicationId)
  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

  // The queue in the order the list page shows it, so next/back move the way
  // the list reads rather than however the server happened to sort.
  const queue = useMemo(
    () =>
      roleIds.flatMap((r) =>
        rows
          .filter((x) => x.role_id === r)
          .filter(
            (x) =>
              isChief ||
              (x.kind === 'rejection_post_interview' &&
                x.interviewers.some((iv) => iv.nuid === currentUser?.nuid))
          )
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      ),
    [rows, roleIds, isChief, currentUser?.nuid]
  )
  const index = queue.findIndex((r) => r.application_id === applicationId)
  const nextUnwritten = queue
    .slice(index + 1)
    .find((r) => feedbackState(r) !== 'submitted')
  const previous = index > 0 ? queue[index - 1] : undefined

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingText />
      </PageContainer>
    )
  }

  if (!row) {
    return (
      <PageContainer>
        <BackToQueue />
        <p className="text-text-faint text-sm">
          This applicant isn’t in your decision queue — either they aren’t
          awaiting a message, or you didn’t interview them.
        </p>
      </PageContainer>
    )
  }

  return (
    <DraftBody
      key={row.application_id}
      row={row}
      cycleId={cycleId}
      cycleName={cycles.find((c) => c.id === cycleId)?.name ?? ''}
      template={templates.find((t) => t.kind === row.kind)}
      context={contextById[applicationId]}
      contextLoading={contextLoading}
      reviewQuestions={reviewQuestions}
      canWrite={
        row.interviewers.some((iv) => iv.nuid === currentUser?.nuid) ||
        !!currentUser?.roles.some((r) => r === 'chief' || r === 'admin')
      }
      nextHref={
        nextUnwritten
          ? `/reviewer/decisions/${nextUnwritten.application_id}`
          : undefined
      }
      previousHref={
        previous ? `/reviewer/decisions/${previous.application_id}` : undefined
      }
      position={index >= 0 ? { index, total: queue.length } : undefined}
    />
  )
}

// Split out so the draft state is keyed on the row and resets when next/back
// moves to another applicant.
function DraftBody({
  row,
  cycleId,
  cycleName,
  template,
  context,
  contextLoading,
  reviewQuestions,
  canWrite,
  nextHref,
  previousHref,
  position,
}: {
  row: DecisionRow
  cycleId: string
  cycleName: string
  template?: DecisionTemplate
  context?: DecisionContext
  contextLoading: boolean
  reviewQuestions: ReviewQuestion[]
  canWrite: boolean
  nextHref?: string
  previousHref?: string
  position?: { index: number; total: number }
}) {
  const { roleLabel, roleChipClass } = useRoleLookup()
  const draft = useFeedbackDraft(row, cycleId, canWrite)
  const rendered = renderDecision(
    { ...row, feedback: draft.feedback, compliments: draft.compliments },
    template,
    cycleName,
    roleLabel(row.role_id)
  )

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <div className={cn('bg-white pb-6', PAGE_X, PAGE_TOP)}>
        <PageHeader
          back={<BackToQueue name={row.full_name} />}
          title={row.full_name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Badge className={roleChipClass(row.role_id)}>
                {roleLabel(row.role_id)}
              </Badge>
              <span className="text-text-muted text-sm break-all">
                {row.email}
              </span>
            </span>
          }
          actions={
            <>
              {position && (
                <span className="font-display text-text-subtle mr-3 text-[11px] tracking-wider uppercase">
                  Feedback {position.index + 1} of {position.total}
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
                    Next to write
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
            <DecisionContextPanel
              context={context}
              reviewQuestions={reviewQuestions}
              isLoading={contextLoading}
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

function BackToQueue({ name }: { name?: string }) {
  const { data: user } = useCurrentUser()
  const isChief = !!user?.roles.some((r) => r === 'chief' || r === 'admin')
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
              { label: 'My work', href: '/reviewer/my-work' },
              { label: 'Feedback', href: '/reviewer/my-work?phase=feedback' },
              current,
            ]
      }
    />
  )
}
