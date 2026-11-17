'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, ChevronRight, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DueLine } from '@/components/ui/due-line'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_ROW } from '@/components/ui/table-styles'
import type { ApplicationStage } from '@/lib/api/types'
import { type BoardEntry, useReviewBoard } from '@/lib/queries/reviewer-pools'
import { useCurrentUser } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { ApplicationDetail } from '../../../applications/components/ApplicationDetail'
import { TASK_STATE } from '../../../my-work/useLeadWork'
import {
  type PositionState,
  usePositions,
} from '../../reviews/components/ReviewsClient'

type View = 'everyone' | 'mine'

export function ReviewingClient() {
  const {
    scope,
    cycleId,
    positions,
    isLoading: positionsLoading,
  } = usePositions()
  const { data: board, isLoading } = useReviewBoard(cycleId, { history: true })
  const { data: me } = useCurrentUser()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rows = board ?? []
  const mine = rows.filter((r) =>
    r.reviewers.some((x) => x.leadNuid === me?.nuid)
  )
  const myLeft = mine.filter(
    (r) => !r.reviewers.find((x) => x.leadNuid === me?.nuid)?.submitted
  ).length
  const view: View =
    params.get('view') === 'mine' && mine.length > 0 ? 'mine' : 'everyone'

  function setView(next: View) {
    const q = new URLSearchParams(params)
    if (next === 'mine') q.set('view', 'mine')
    else q.delete('view')
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Reviews & progress"
        subtitle={
          view === 'mine'
            ? 'Read each application and score it.'
            : "Who's done, who's behind, and where each applicant stands."
        }
        actions={
          mine.length > 0 && (
            <div className="flex items-center gap-6">
              {view === 'mine' && (
                <div className="flex w-36 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between">
                    <Label>{myLeft === 0 ? 'All done' : 'Done'}</Label>
                    <span className="text-ink text-sm font-semibold tabular-nums">
                      {mine.length - myLeft}
                      <span className="text-text-subtle font-normal">
                        {' '}
                        / {mine.length}
                      </span>
                    </span>
                  </span>
                  <Progress done={mine.length - myLeft} total={mine.length} />
                </div>
              )}
              <SegmentedTabs
                tabs={[
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'mine', label: 'My reviews', count: myLeft },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          )
        }
      />
      {!cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not a chief on any cycle yet" />
        )
      ) : isLoading || positionsLoading || scope.roles.isLoading ? (
        <LoadingText />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No one is in review yet"
          description="Assign reviewers and release reviews to get started."
          action={
            <Link
              href="/reviewer/cycle/reviews"
              className="text-ink inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Assign reviewers <ArrowRight size={14} />
            </Link>
          }
        />
      ) : view === 'mine' ? (
        <MyReviews rows={mine} me={me?.nuid ?? ''} positions={positions} />
      ) : (
        <Everyone cycleId={cycleId} rows={rows} positions={positions} />
      )}
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="block h-1.5 w-full bg-gray-100">
      <span
        className="bg-ink block h-full transition-[width]"
        style={{ width: `${total ? (done / total) * 100 : 0}%` }}
      />
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
      {children}
    </span>
  )
}

function MyReviews({
  rows,
  me,
  positions,
}: {
  rows: BoardEntry[]
  me: string
  positions: PositionState[]
}) {
  const tasks = rows.map((r) => {
    const mine = r.reviewers.find((x) => x.leadNuid === me)
    const state = mine?.submitted ? 'done' : mine?.started ? 'draft' : 'todo'
    return { row: r, state } as const
  })
  const sections = positions
    .map((p) => ({
      position: p,
      tasks: tasks
        .filter((t) => t.row.roleId === p.roleId)
        .sort(
          (a, b) => Number(a.state === 'done') - Number(b.state === 'done')
        ),
    }))
    .filter((s) => s.tasks.length > 0)

  return (
    <div className="flex flex-col gap-10">
      {sections.map(({ position, tasks }) => (
        <section key={position.roleId} className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
                {position.name}
              </h2>
              {position.reviewClosesAt && (
                <DueLine date={position.reviewClosesAt} label="Reviews due" />
              )}
            </div>
            <Label>
              {tasks.filter((t) => t.state === 'done').length} of {tasks.length}{' '}
              done
            </Label>
          </div>
          <div className={TABLE_FRAME}>
            {tasks.map(({ row, state }) => (
              <Link
                key={row.applicationId}
                href={`/reviewer/my-reviews/${row.applicationId}`}
                className={cn(
                  'group flex flex-wrap items-center gap-x-6 gap-y-2',
                  TABLE_ROW
                )}
              >
                <span className="text-ink min-w-0 flex-1 truncate font-semibold">
                  {row.name}
                </span>
                <Badge className={TASK_STATE[state].className}>
                  {state === 'todo'
                    ? 'To be reviewed'
                    : TASK_STATE[state].label}
                </Badge>
                <span className="text-text-subtle group-hover:text-ink flex w-20 items-center justify-end gap-1 text-sm font-medium transition-colors">
                  {state === 'done' ? 'View' : 'Review'}
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

type Tab = 'reviewers' | 'waiting' | 'done'

function Everyone({
  cycleId,
  rows,
  positions,
}: {
  cycleId: string
  rows: BoardEntry[]
  positions: PositionState[]
}) {
  const [picked, setPicked] = useState('')
  const [tab, setTab] = useState<Tab>('reviewers')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const withReviews = positions.filter((p) =>
    rows.some((r) => r.roleId === p.roleId)
  )
  const position =
    withReviews.find((p) => p.roleId === picked) ?? withReviews[0]
  const inOpening = rows.filter((r) => r.roleId === position?.roleId)
  const reviews = inOpening.flatMap((r) => r.reviewers)
  const submitted = reviews.filter((x) => x.submitted).length

  const tally = new Map<
    string,
    { name: string; done: number; started: number; total: number }
  >()
  for (const x of reviews) {
    const t = tally.get(x.leadNuid) ?? {
      name: x.name,
      done: 0,
      started: 0,
      total: 0,
    }
    t.total++
    if (x.submitted) t.done++
    if (x.started) t.started++
    tally.set(x.leadNuid, t)
  }
  const people = [...tally.entries()]
    .map(([nuid, t]) => ({ nuid, ...t }))
    .sort(
      (a, b) =>
        a.done / a.total - b.done / b.total || a.name.localeCompare(b.name)
    )

  const complete = (r: BoardEntry) =>
    r.reviewers.length > 0 && r.reviewers.every((x) => x.submitted)
  const waiting = inOpening.filter((r) => !complete(r))
  const done = inOpening.filter(complete)
  const shown = tab === 'done' ? done : waiting
  const opened = rows.find((r) => r.applicationId === open)

  if (!position) return null

  return (
    <>
      <Card padding="none">
        {withReviews.length > 1 && (
          <nav className="flex gap-6 overflow-x-auto border-b border-gray-200 px-5">
            {withReviews.map((p) => (
              <button
                key={p.roleId}
                type="button"
                onClick={() => {
                  setPicked(p.roleId)
                  setExpanded(null)
                }}
                className={cn(
                  '-mb-px shrink-0 border-b-2 py-3 text-sm font-medium transition-colors',
                  p.roleId === position.roleId
                    ? 'border-ink text-ink'
                    : 'text-text-muted hover:text-ink border-transparent'
                )}
              >
                {p.name}
              </button>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4">
          {position.reviewClosesAt ? (
            <DueLine date={position.reviewClosesAt} label="Reviews due" />
          ) : (
            <span className="text-text-subtle text-sm">No due date</span>
          )}
          <div className="flex w-56 flex-col gap-1.5">
            <span className="flex items-baseline justify-between">
              <Label>Reviews in</Label>
              <span className="text-ink text-sm font-semibold tabular-nums">
                {submitted}
                <span className="text-text-subtle font-normal">
                  {' '}
                  / {reviews.length}
                </span>
              </span>
            </span>
            <Progress done={submitted} total={reviews.length} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-y border-gray-100 px-4 py-2">
          {(
            [
              ['reviewers', 'Reviewers', people.length],
              ['waiting', 'Waiting on reviews', waiting.length],
              ['done', 'All reviews in', done.length],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-3 py-1 text-sm transition-colors',
                tab === id
                  ? 'bg-ink text-white'
                  : 'text-text-muted hover:text-ink hover:bg-gray-50'
              )}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {tab === 'reviewers' ? (
          <div className="max-h-[60vh] overflow-y-auto">
            {people.map((p) => {
              const isOpen = expanded === p.nuid
              return (
                <div
                  key={p.nuid}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : p.nuid)}
                    className="group flex w-full items-center gap-6 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="text-ink flex w-48 shrink-0 items-center gap-1.5 truncate text-sm font-medium">
                      <ChevronRight
                        size={14}
                        className={cn(
                          'text-text-subtle shrink-0 transition-transform',
                          isOpen && 'rotate-90'
                        )}
                      />
                      {p.name}
                    </span>
                    <span className="flex-1">
                      <Progress done={p.done} total={p.total} />
                    </span>
                    <span className="text-ink w-16 shrink-0 text-right text-sm tabular-nums">
                      {p.done}
                      <span className="text-text-subtle"> / {p.total}</span>
                    </span>
                    <span
                      className={cn(
                        'w-20 shrink-0 text-right text-xs',
                        p.done === p.total
                          ? 'text-emerald-600'
                          : p.started > 0
                            ? 'text-ink'
                            : 'text-text-subtle'
                      )}
                    >
                      {p.done === p.total
                        ? 'Done'
                        : p.started > 0
                          ? 'In progress'
                          : 'Not started'}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="bg-gray-50 pb-2">
                      {inOpening
                        .flatMap((r) =>
                          r.reviewers
                            .filter((x) => x.leadNuid === p.nuid)
                            .map((x) => ({ row: r, review: x }))
                        )
                        .sort(
                          (a, b) =>
                            Number(a.review.submitted) -
                            Number(b.review.submitted)
                        )
                        .map(({ row, review }) => (
                          <li key={review.assignmentId}>
                            <button
                              type="button"
                              onClick={() => setOpen(row.applicationId)}
                              className="flex w-full items-center justify-between gap-4 py-1.5 pr-5 pl-12 text-left text-sm hover:bg-gray-100"
                            >
                              <span className="text-ink truncate">
                                {row.name}
                              </span>
                              <span
                                className={cn(
                                  'flex shrink-0 items-center gap-1 text-xs',
                                  review.submitted
                                    ? 'text-emerald-600'
                                    : review.started
                                      ? 'text-ink'
                                      : 'text-text-subtle'
                                )}
                              >
                                {review.submitted && (
                                  <Check size={12} strokeWidth={3} />
                                )}
                                {review.submitted
                                  ? 'Submitted'
                                  : review.started
                                    ? 'In progress'
                                    : 'Not started'}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ) : shown.length === 0 ? (
          <p className="text-text-subtle px-5 py-6 text-center text-sm">
            {tab === 'done'
              ? 'No one is fully reviewed yet.'
              : 'All reviews are in.'}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {shown.map((r) => {
              const count = r.reviewers.filter((x) => x.submitted).length
              return (
                <button
                  key={r.applicationId}
                  type="button"
                  onClick={() => setOpen(r.applicationId)}
                  className="flex w-full items-center gap-4 border-b border-gray-100 px-5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-gray-50"
                >
                  <span className="text-ink w-48 shrink-0 truncate text-sm font-medium">
                    {r.name}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {r.reviewers.map((x) => (
                      <span
                        key={x.assignmentId}
                        title={
                          x.submitted
                            ? `${x.name} reviewed`
                            : `${x.name} hasn’t reviewed yet`
                        }
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium',
                          x.submitted
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'text-text-muted bg-gray-100'
                        )}
                      >
                        {x.submitted ? (
                          <Check size={12} strokeWidth={3} />
                        ) : (
                          <Clock size={12} />
                        )}
                        {x.name}
                      </span>
                    ))}
                  </span>
                  <span className="text-text-muted w-10 shrink-0 text-right text-xs tabular-nums">
                    {count}/{r.reviewers.length}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {opened && (
        <ApplicationDetail
          applicant={{
            id: opened.applicationId,
            nuid: opened.applicantNuid,
            fullName: opened.name,
            email: opened.email,
            role: opened.roleId,
            cycleId,
            stage: opened.stage as ApplicationStage,
            submittedAt: opened.submittedAt,
            returner: opened.returner,
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
