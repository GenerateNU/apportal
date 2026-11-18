'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { useCycleScope } from '@/hooks/useCycleScope'
import type { ReviewQuestion } from '@/lib/api/types'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { cn } from '@/lib/utils'
import { FormStatusBadge } from '../../components/FormStatusBadge'

const ROW =
  'grid items-center gap-3 px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:gap-4'

export function ReviewFormsClient() {
  const scope = useCycleScope()
  const { data: reviewQuestions = [], isLoading } = useReviewQuestions(
    scope.cycleId
  )

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Review forms"
        subtitle="Create the form reviewers use to score each position's applicants. Finish it before reviews start."
      />
      {!scope.cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not a chief on any cycle yet" />
        )
      ) : scope.roles.isLoading ? (
        <LoadingText />
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
            <span>Review form</span>
            <span>Ranking</span>
          </div>
          {isLoading ? (
            <LoadingText className="px-5 py-4" />
          ) : (
            scope.roles.roleIds.map((roleId) => (
              <PositionReviewForm
                key={roleId}
                cycleId={scope.cycleId}
                roleId={roleId}
                roleName={scope.roles.roleLabel(roleId)}
                questions={reviewQuestions.filter(
                  (q) => q.role_id === null || q.role_id === roleId
                )}
              />
            ))
          )}
        </Card>
      )}
    </div>
  )
}

function PositionReviewForm({
  cycleId,
  roleId,
  roleName,
  questions,
}: {
  cycleId: string
  roleId: string
  roleName: string
  questions: ReviewQuestion[]
}) {
  const router = useRouter()
  const written = questions.length > 0
  const ranked = questions.filter(
    (q) => q.question_type === 'score' && q.ranked
  ).length
  const href = `/admin/applications/${cycleId}/${roleId}/builder?from=review-forms&tab=review`

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(href)
      }}
      className={cn(
        ROW,
        'cursor-pointer border-b border-gray-100 py-3 transition-colors last:border-b-0 hover:bg-gray-50'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-ink truncate font-semibold">{roleName}</span>
        <FormStatusBadge written={written} />
      </div>

      <span
        className={cn('text-sm', written ? 'text-ink' : 'text-text-subtle')}
      >
        {written
          ? `${questions.length} question${questions.length === 1 ? '' : 's'}`
          : 'No questions yet'}
      </span>

      <span
        className={cn(
          'text-sm',
          !written
            ? 'text-text-subtle'
            : ranked > 0
              ? 'text-text-muted'
              : 'text-amber-600'
        )}
      >
        {!written
          ? '—'
          : ranked > 0
            ? `${ranked} count${ranked === 1 ? 's' : ''} toward ranking`
            : 'None count toward ranking'}
      </span>
    </div>
  )
}
