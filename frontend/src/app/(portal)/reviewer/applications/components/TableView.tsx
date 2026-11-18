import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { Interview, Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication, ApplicationStage } from './types'
import type { AnswerFilter, FilterChangeHandler } from './FilterButton'
import { FILTER_STAGES } from './constants'
import { isAvailabilityQuestion } from './meetingAvailability'
import { ApplicantRow } from './ApplicantRow'
import { FilterChips } from './FilterButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'
import {
  chunkIds,
  useInterviewsByApplicationIdBatches,
} from '@/lib/queries/interviews'

const TRAILING_COLUMNS = ['Stage', 'Submitted', 'Availability']

const HEAD_CELL = cn(TABLE_HEAD, 'border-r border-r-gray-100 text-left')

// How many rows from the end the next fetch starts. Counted in rows rather
// than pixels so it doesn't encode an assumption about row height, zoom, or
// font size — the trigger sits at a fixed position in the list regardless.
const LOAD_AHEAD_ROWS = 15

export function TableView({
  applicants,
  stageCounts,
  activeStage,
  onStageChange,
  columns,
  questionsByCycleRole,
  answersByApplicationId,
  answersLoadingByApplicationId,
  availabilityByApplicationId,
  selectedApplicationId,
  onSelectApplication,
  filters,
  onFilterChange,
  hasAvailability,
  roleOptions,
  tagNames,
  loading,
  showStages = true,
  fullPageHref = (id) => `/reviewer/applications/${id}`,
  hasMore,
  loadingMore,
  onLoadMore,
  search,
}: {
  applicants: ApplicantApplication[]
  // Counted server-side over the whole match, not the page — a page's worth of
  // rows can't tell you how many are in each stage.
  stageCounts: Record<string, number>
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  columns: Question[]
  questionsByCycleRole: Record<string, Question[]>
  answersByApplicationId: Record<string, WrittenAnswer[]>
  // Per application, whether its answers request is still in flight.
  answersLoadingByApplicationId: Record<string, boolean>
  availabilityByApplicationId: Record<string, string[]>
  selectedApplicationId: string | null
  onSelectApplication: (id: string) => void
  filters: AnswerFilter[]
  onFilterChange: FilterChangeHandler
  hasAvailability?: boolean
  roleOptions?: string[]
  tagNames?: string[]
  // A fetch is in flight while the previous rows are still on screen.
  loading?: boolean
  showStages?: boolean
  fullPageHref?: (applicationId: string) => string
  search?: React.ReactNode
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  // "All" is the sum rather than a separate count, since stageCounts already
  // excludes drafts and reflects every other active filter.
  const totalCount = Object.values(stageCounts).reduce((sum, n) => sum + n, 0)
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all' ? totalCount : (stageCounts[stage] ?? 0)

  // Meeting availability is already a trailing column, rendered as compact day
  // tags — as a regular column it would be a truncated wall of checkbox text.
  // That's a fact about this grid, so the exclusion lives here rather than in
  // the shared `columns` the filter menu and the detail panel also read.
  const tableColumns = useMemo(
    () => columns.filter((q) => !isAvailabilityQuestion(q.question_text)),
    [columns]
  )
  const columnCount = 2 + tableColumns.length + TRAILING_COLUMNS.length

  // Batch fetch interviews for the current page of applications. One request for
  // the whole page rather than one per row, following the pattern in CLAUDE.md.
  const applicationIds = useMemo(
    () => applicants.map((a) => a.id),
    [applicants]
  )
  const applicationIdBatches = useMemo(
    () => chunkIds(applicationIds),
    [applicationIds]
  )
  const interviewQueries =
    useInterviewsByApplicationIdBatches(applicationIdBatches)
  const interviewsByApplicationId = useMemo(() => {
    const map: Record<string, Interview | null> = {}
    for (const query of interviewQueries) {
      if (query.data) {
        Object.assign(map, query.data)
      }
    }
    return map
  }, [interviewQueries])

  // Load the next page when the sentinel enters the scroll pane. Rooted at the
  // pane rather than the viewport, since the pane is what actually scrolls.
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLTableRowElement>(null)
  // Sits LOAD_AHEAD_ROWS from the end, so it comes into view — and starts the
  // fetch — while there are still that many rows left to scroll through.
  // Clamped to 0 so a short list triggers immediately and fills the pane.
  const triggerIndex = Math.max(0, applicants.length - LOAD_AHEAD_ROWS)
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root || !hasMore || !onLoadMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore()
      },
      { root }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // triggerIndex re-runs this after every append, so the observer follows
    // the sentinel to its new position instead of watching a detached node.
  }, [hasMore, onLoadMore, triggerIndex])

  return (
    <div className={cn(TABLE_FRAME, 'flex min-h-0 flex-1 flex-col')}>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
        {search}
        {showStages && (
          <Select
            value={activeStage}
            onValueChange={(v) => onStageChange(v as ApplicationStage | 'all')}
          >
            <SelectTrigger
              className="h-8 w-52 border-gray-200 text-xs font-normal"
              aria-label="Filter by stage"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_STAGES.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label} ({countByStage(value)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="min-w-0 flex-1">
          <FilterChips
            filters={filters}
            columns={columns}
            onFilterChange={onFilterChange}
            hasAvailability={hasAvailability}
            roleOptions={roleOptions}
            tagNames={tagNames}
          />
        </div>
      </div>

      {/* This pane is the only thing that scrolls, which is what the sticky
          header below pins against — the toolbar above sits outside it and
          stays put. */}
      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-auto transition-opacity ${
          loading ? 'opacity-60' : ''
        }`}
      >
        <table className="h-full w-full min-w-180">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={cn(HEAD_CELL, 'min-w-48 whitespace-nowrap')}>
                Name
              </th>
              <th className={cn(HEAD_CELL, 'min-w-36 whitespace-nowrap')}>
                Rating
              </th>
              {tableColumns.map((q) => (
                <th
                  key={q.id}
                  title={q.question_text}
                  className={cn(HEAD_CELL, 'max-w-50 truncate last:border-r-0')}
                >
                  {q.question_text}
                </th>
              ))}
              {TRAILING_COLUMNS.map((label) => (
                <th
                  key={label}
                  className={cn(HEAD_CELL, 'whitespace-nowrap last:border-r-0')}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applicants.length > 0 ? (
              applicants.map((a, i) => (
                <Fragment key={a.id}>
                  <ApplicantRow
                    applicant={a}
                    columns={tableColumns}
                    rowQuestions={
                      questionsByCycleRole[`${a.cycleId}:${a.role}`] ?? []
                    }
                    answers={answersByApplicationId[a.id] ?? []}
                    answersLoading={!!answersLoadingByApplicationId[a.id]}
                    availabilityDays={availabilityByApplicationId[a.id] ?? []}
                    interview={interviewsByApplicationId[a.id] ?? null}
                    isSelected={selectedApplicationId === a.id}
                    onSelect={() => onSelectApplication(a.id)}
                    fullPageHref={fullPageHref(a.id)}
                  />
                  {i === triggerIndex && (
                    // 1px rather than 0: a zero-area target is an edge case
                    // IntersectionObserver implementations disagree on, and a
                    // tripwire that never fires is the whole bug.
                    <tr ref={sentinelRef} aria-hidden>
                      <td colSpan={columnCount} className="h-px p-0" />
                    </tr>
                  )}
                </Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columnCount}
                  className="text-text-subtle px-4 py-10 text-center text-sm"
                >
                  No applicants found.
                </td>
              </tr>
            )}
            {/* Fills any leftover height in the box with the same column
                gridlines, so they run to the bottom instead of stopping
                right after the last real row. */}
            <tr className="h-full">
              {Array.from({
                length: columnCount,
              }).map((_, i) => (
                <td
                  key={i}
                  className="border-r border-gray-100 last:border-r-0"
                />
              ))}
            </tr>
            {/* Breathing room past the last row once the list is long enough
                to scroll, and the only place the append announces itself now
                that there's no footer. Fixed height either way, so nothing
                shifts when the message appears. */}
            <tr>
              <td
                colSpan={columnCount}
                className="text-text-subtle h-10 text-center text-xs"
              >
                {loadingMore ? 'Loading more…' : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
