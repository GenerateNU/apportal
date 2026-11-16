'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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
import { RubricSettings } from '../../components/FormParts'

const ROW =
  'grid items-center gap-3 px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)] md:gap-4'

export function ReviewFormsClient() {
  const scope = useCycleScope()
  const { data: reviewQuestions = [] } = useReviewQuestions(scope.cycleId)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Review forms"
        subtitle="How leads score each position's applicants. Write them any time before reviews start."
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
            <span>Review form</span>
            <span>Scoring</span>
          </div>
          {scope.roles.roleIds.map((roleId) => (
            <PositionReviewForm
              key={roleId}
              href={`/admin/applications/${scope.cycleId}/${roleId}/builder?from=review-forms&tab=review`}
              roleName={scope.roles.roleLabel(roleId)}
              questions={reviewQuestions.filter(
                (q) => q.role_id === null || q.role_id === roleId
              )}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function PositionReviewForm({
  href,
  roleName,
  questions,
}: {
  href: string
  roleName: string
  questions: ReviewQuestion[]
}) {
  const rubric = questions.filter((q) => q.question_type === 'score')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const sameScale = rubric.every(
    (q) =>
      q.score_min === rubric[0].score_min && q.score_max === rubric[0].score_max
  )
  const counted = rubric.filter((q) => q.ranked).length

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(href)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') router.push(href)
        }}
        className={cn(
          ROW,
          'cursor-pointer py-3 transition-colors hover:bg-gray-50'
        )}
      >
        <span className="text-ink truncate font-semibold">{roleName}</span>
        <span className="flex flex-col text-sm">
          {questions.length === 0 ? (
            <span className="text-text-subtle">Not written</span>
          ) : (
            <>
              <span className="text-ink">
                {questions.length} question{questions.length === 1 ? '' : 's'}
                {rubric.length > 0 && ` · ${rubric.length} scored`}
              </span>
              {rubric.length === 0 && (
                <span className="text-xs text-amber-600">
                  Needs a score question
                </span>
              )}
            </>
          )}
        </span>
        {rubric.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(!open)
            }}
            className="text-text-muted hover:text-ink flex items-center gap-1 justify-self-start text-sm"
          >
            {sameScale
              ? `${rubric[0].score_min}–${rubric[0].score_max}`
              : 'Mixed scales'}{' '}
            · {counted} of {rubric.length} count toward cutoff
            <ChevronDown
              size={14}
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : (
          <span className="text-text-subtle text-sm">—</span>
        )}
      </div>
      {open && rubric.length > 0 && (
        <div className="px-5 pb-3">
          <RubricSettings roleName={roleName} rubric={rubric} />
        </div>
      )}
    </div>
  )
}
