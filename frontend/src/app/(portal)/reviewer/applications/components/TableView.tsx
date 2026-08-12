import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { Question, WrittenAnswer } from '@/lib/api/types'
import type { ApplicantApplication, ApplicationStage } from './types'
import type { AnswerFilter } from './FilterButton'
import { FILTER_STAGES } from './constants'
import { isAvailabilityQuestion } from './meetingAvailability'
import { ApplicantRow } from './ApplicantRow'
import { FilterChips } from './FilterButton'

const TRAILING_COLUMNS = ['Stage', 'Submitted', 'Availability']

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
  selectable,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectedApplicationId,
  onSelectApplication,
  filters,
  onFilterChange,
  bulkBar,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
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
  // Row/select-all checkboxes only make sense alongside the bulk-move
  // toolbar, which is chief/admin-only — other reviewers never see them.
  selectable: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  selectedApplicationId: string | null
  onSelectApplication: (id: string) => void
  filters: AnswerFilter[]
  onFilterChange: (
    filter: AnswerFilter | null,
    action: 'add' | 'remove'
  ) => void
  // Rendered in the filter row's place while a selection is active. Owned by
  // the parent, which holds the selection and the bulk mutation.
  bulkBar?: React.ReactNode
  // A fetch is in flight while the previous rows are still on screen.
  loading?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  // "All" is the sum rather than a separate count, since stageCounts already
  // excludes drafts and reflects every other active filter.
  const totalCount = Object.values(stageCounts).reduce((sum, n) => sum + n, 0)
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all' ? totalCount : (stageCounts[stage] ?? 0)

  const allSelected =
    applicants.length > 0 && applicants.every((a) => selectedIds.has(a.id))
  const someSelected = applicants.some((a) => selectedIds.has(a.id))

  // Meeting availability is already a trailing column, rendered as compact day
  // tags — as a regular column it would be a truncated wall of checkbox text.
  // That's a fact about this grid, so the exclusion lives here rather than in
  // the shared `columns` the filter menu and the detail panel also read.
  const tableColumns = useMemo(
    () => columns.filter((q) => !isAvailabilityQuestion(q.question_text)),
    [columns]
  )
  const columnCount =
    tableColumns.length + TRAILING_COLUMNS.length + (selectable ? 1 : 0)

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
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
      <div className="space-y-3 border-b border-gray-100 px-4 py-3">
        {bulkBar ?? (
          <FilterChips
            filters={filters}
            columns={columns}
            onFilterChange={onFilterChange}
          />
        )}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
          {FILTER_STAGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onStageChange(value)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeStage === value
                  ? 'text-brand-blue bg-blue-50'
                  : 'text-text-muted hover:text-text-secondary hover:bg-gray-100'
              }`}
            >
              {label}
              <span className="text-text-subtle ml-1.5 text-xs">
                {countByStage(value)}
              </span>
            </button>
          ))}
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
            <tr className="bg-gray-50">
              {selectable && (
                <th className="w-10 border-r border-b border-gray-100 bg-gray-50 px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {tableColumns.map((q) => (
                <th
                  key={q.id}
                  title={q.question_text}
                  className="text-text-muted max-w-50 truncate border-r border-b border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs font-medium last:border-r-0"
                >
                  {q.question_text}
                </th>
              ))}
              {TRAILING_COLUMNS.map((label) => (
                <th
                  key={label}
                  className="text-text-muted border-r border-b border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs font-medium whitespace-nowrap last:border-r-0"
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
                    selectable={selectable}
                    selected={selectedIds.has(a.id)}
                    onToggleSelect={() => onToggleSelect(a.id)}
                    isSelected={selectedApplicationId === a.id}
                    onSelect={() => onSelectApplication(a.id)}
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
