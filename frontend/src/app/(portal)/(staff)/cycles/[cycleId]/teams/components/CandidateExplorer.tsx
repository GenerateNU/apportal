'use client'

import { useMemo, useState } from 'react'
import { LayoutGrid, Rows3 } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'
import {
  FilterChips,
  type AnswerFilter,
  type FilterChangeHandler,
} from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/FilterButton'
import { useApplicationFilters } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/useApplicationFilters'
import type { ListAction } from './AddToMyList'
import { CandidatesBoard } from './CandidatesBoard'
import { CompareTable } from './CompareTable'

type View = 'rating' | 'team'

const VIEWS: { id: View; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'rating', label: 'By rating', Icon: LayoutGrid },
  { id: 'team', label: 'By team', Icon: Rows3 },
]

export function CandidateExplorer({
  cycleId,
  roleId,
  listAction,
  filterable = true,
  fullPageHref,
}: {
  cycleId: string
  roleId: string
  listAction?: ListAction
  filterable?: boolean
  fullPageHref?: (applicationId: string) => string
}) {
  const [view, setView] = useState<View>('rating')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AnswerFilter[]>([])
  const defaultRoles = useMemo(() => (roleId ? [roleId] : []), [roleId])
  const { columns, hasAvailability, tagNames, filterParams } =
    useApplicationFilters({ cycleId, defaultRoles, filters, setFilters })

  const handleFilterChange: FilterChangeHandler = (f, action) => {
    if (!f) return
    setFilters((prev) =>
      action === 'remove'
        ? prev.filter((x) => x.question_id !== f.question_id)
        : action === 'update'
          ? prev.map((x) => (x.question_id === f.question_id ? f : x))
          : [...prev, f]
    )
  }

  const viewProps = {
    cycleId,
    roleId,
    filterParams,
    filtered: filters.length > 0,
    search,
    listAction,
    fullPageHref,
    wanted: filters
      .filter((f) => f.special === 'wanted')
      .flatMap((f) => (Array.isArray(f.values) ? f.values : [f.values])),
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search applicants"
          className="sm:w-64"
        />
        {filterable && (
          <div className="min-w-0 flex-1">
            <FilterChips
              size="lg"
              filters={filters}
              columns={columns}
              onFilterChange={handleFilterChange}
              hasAvailability={hasAvailability}
              hiddenSpecials={['role', 'stage']}
              tagNames={tagNames}
              wantedFilter
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="View"
            className="inline-flex h-9 border border-gray-200 bg-white"
          >
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                aria-label={label}
                title={label}
                onClick={() => setView(id)}
                className={cn(
                  'flex w-9 items-center justify-center transition-colors not-last:border-r not-last:border-gray-200',
                  view === id
                    ? 'text-ink bg-gray-100'
                    : 'text-text-muted hover:text-ink'
                )}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === 'rating' ? (
        <CandidatesBoard {...viewProps} />
      ) : (
        <CompareTable {...viewProps} />
      )}
    </div>
  )
}
