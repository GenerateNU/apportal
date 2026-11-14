'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { BackLink } from '@/components/ui/back-link'
import { Badge } from '@/components/ui/badge'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
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

  // The queue in the order the list page shows it, so next/back move the way
  // the list reads rather than however the server happened to sort.
  const queue = useMemo(
    () =>
      roleIds.flatMap((r) =>
        rows
          .filter((x) => x.role_id === r)
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      ),
    [rows, roleIds]
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
    <PageContainer>
      <PageHeader
        size="md"
        back={<BackToQueue />}
        title={row.full_name}
        subtitle={<span className="break-all">{row.email}</span>}
        actions={
          <Badge className={roleChipClass(row.role_id)}>
            {roleLabel(row.role_id)}
          </Badge>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <DecisionContextPanel
            context={context}
            reviewQuestions={reviewQuestions}
            isLoading={contextLoading}
          />
        </div>

        <div className="flex flex-col gap-6">
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        {previousHref ? (
          <Button asChild variant="ghost">
            <Link href={previousHref}>
              <ArrowLeft data-icon="inline-start" size={14} />
              Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Button asChild>
            <Link href={nextHref}>
              Next to write
              <ArrowRight data-icon="inline-end" size={14} />
            </Link>
          </Button>
        ) : (
          <span className="text-text-faint text-sm">
            Nothing left to write — your paragraphs save as you type.
          </span>
        )}
      </div>
    </PageContainer>
  )
}

function BackToQueue() {
  return <BackLink href="/reviewer/decisions">Decision feedback</BackLink>
}
