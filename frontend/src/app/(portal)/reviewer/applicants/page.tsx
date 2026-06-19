'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, List, Columns, Plus, X, GraduationCap, Hash, Star } from 'lucide-react'
import { mockApplicants } from '@/lib/mock-applicants'
import type { ApplicationStage, Applicant, Rating } from '@/types/applicant'

type View = 'table' | 'kanban'
type FilterKey = 'major' | 'year' | 'rating'

const ORDERED_STAGES: ApplicationStage[] = ['application', 'interview', 'offered', 'rejected']

const FILTER_STAGES: { label: string; value: ApplicationStage | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Application', value: 'application' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offered', value: 'offered' },
  { label: 'Rejected', value: 'rejected' },
]

const stageBadge: Record<ApplicationStage, string> = {
  application: 'bg-blue-50 text-blue-700',
  interview: 'bg-yellow-50 text-yellow-700',
  offered: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

const stageLabel: Record<ApplicationStage, string> = {
  application: 'Application',
  interview: 'Interview',
  offered: 'Offered',
  rejected: 'Rejected',
}

const stageDot: Record<ApplicationStage, string> = {
  application: 'bg-blue-500',
  interview: 'bg-amber-400',
  offered: 'bg-green-500',
  rejected: 'bg-red-400',
}

const ratingBadge: Record<Rating, string> = {
  no_hire: 'bg-red-50 text-red-700',
  good_hire: 'bg-yellow-50 text-yellow-700',
  great_hire: 'bg-blue-50 text-blue-700',
  must_hire: 'bg-green-50 text-green-700',
}

const ratingLabel: Record<Rating, string> = {
  no_hire: 'No Hire',
  good_hire: 'Good Hire',
  great_hire: 'Great Hire',
  must_hire: 'Must Hire',
}

const ratedStages: ApplicationStage[] = ['interview', 'offered', 'rejected']

const ALL_RATINGS: Rating[] = ['no_hire', 'good_hire', 'great_hire', 'must_hire']
const ALL_MAJORS = [...new Set(mockApplicants.map((a) => a.major))].sort()
const ALL_YEARS = [...new Set(mockApplicants.map((a) => a.year))].sort((a, b) => a - b)

const FILTER_FIELDS: { key: FilterKey; label: string; Icon: React.ElementType }[] = [
  { key: 'major', label: 'Major', Icon: GraduationCap },
  { key: 'year', label: 'Year', Icon: Hash },
  { key: 'rating', label: 'Rating', Icon: Star },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, onClose, enabled])
}

function ActiveFilterPill<T extends string | number>({
  label,
  values,
  renderValue,
  options,
  onChange,
  onClear,
}: {
  label: string
  values: T[]
  renderValue: (v: T) => string
  options: T[]
  onChange: (next: T[]) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])

  const valueLabel =
    values.length === 1
      ? renderValue(values[0])
      : `${values.length} values`

  return (
    <div ref={ref} className="relative flex items-center">
      <div className="flex items-center rounded-md border border-gray-200 bg-white text-xs shadow-sm">
        <span className="px-2.5 py-1.5 font-medium text-gray-600">{label}</span>
        <span className="border-l border-gray-100 px-2 py-1.5 text-gray-400">is</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="border-l border-gray-100 px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          {valueLabel}
        </button>
        <button
          onClick={onClear}
          className="border-l border-gray-100 rounded-r-md px-2 py-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <label
              key={String(opt)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={values.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              {renderValue(opt)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function AddFilterButton({
  activeKeys,
  onAdd,
}: {
  activeKeys: FilterKey[]
  onAdd: (key: FilterKey) => void
}) {
  const [panel, setPanel] = useState<null | 'fields'>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setPanel(null), panel !== null)

  const available = FILTER_FIELDS.filter((f) => !activeKeys.includes(f.key))

  if (available.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setPanel(panel ? null : 'fields')}
        className="flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
      >
        <Plus className="h-3 w-3" />
        Filter
      </button>

      {panel === 'fields' && (
        <div className="absolute top-full left-0 z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Filter by
          </div>
          <div className="py-1">
            {available.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => {
                  onAdd(key)
                  setPanel(null)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterBar({
  selectedMajors, onChangeMajors,
  selectedYears, onChangeYears,
  selectedRatings, onChangeRatings,
}: {
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
  selectedRatings: Rating[]
  onChangeRatings: (v: Rating[]) => void
}) {
  const activeKeys: FilterKey[] = [
    ...(selectedMajors.length > 0 ? ['major' as FilterKey] : []),
    ...(selectedYears.length > 0 ? ['year' as FilterKey] : []),
    ...(selectedRatings.length > 0 ? ['rating' as FilterKey] : []),
  ]

  // When a field is added via "+", seed it with all options selected
  function handleAdd(key: FilterKey) {
    if (key === 'major') onChangeMajors(ALL_MAJORS)
    if (key === 'year') onChangeYears(ALL_YEARS)
    if (key === 'rating') onChangeRatings(ALL_RATINGS)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
      {selectedMajors.length > 0 && (
        <ActiveFilterPill
          label="Major"
          values={selectedMajors}
          renderValue={(v) => v}
          options={ALL_MAJORS}
          onChange={onChangeMajors}
          onClear={() => onChangeMajors([])}
        />
      )}
      {selectedYears.length > 0 && (
        <ActiveFilterPill
          label="Year"
          values={selectedYears}
          renderValue={(v) => `Year ${v}`}
          options={ALL_YEARS}
          onChange={onChangeYears}
          onClear={() => onChangeYears([])}
        />
      )}
      {selectedRatings.length > 0 && (
        <ActiveFilterPill
          label="Rating"
          values={selectedRatings}
          renderValue={(v) => ratingLabel[v]}
          options={ALL_RATINGS}
          onChange={onChangeRatings}
          onClear={() => onChangeRatings([])}
        />
      )}
      <AddFilterButton activeKeys={activeKeys} onAdd={handleAdd} />
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────

function RatingBadge({ applicant }: { applicant: Applicant }) {
  if (!ratedStages.includes(applicant.stage) || !applicant.rating) {
    return <span className="text-sm text-gray-300">—</span>
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ratingBadge[applicant.rating]}`}
    >
      {ratingLabel[applicant.rating]}
    </span>
  )
}

function ApplicantRow({ applicant }: { applicant: Applicant }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 hover:cursor-pointer">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {applicant.firstName} {applicant.lastName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.nuid}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.email}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.major}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{applicant.year}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadge[applicant.stage]}`}
        >
          {stageLabel[applicant.stage]}
        </span>
      </td>
      <td className="px-4 py-3">
        <RatingBadge applicant={applicant} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDate(applicant.submittedAt)}
      </td>
    </tr>
  )
}

function TableView({
  applicants,
  activeStage,
  onStageChange,
  selectedMajors, onChangeMajors,
  selectedYears, onChangeYears,
  selectedRatings, onChangeRatings,
}: {
  applicants: Applicant[]
  activeStage: ApplicationStage | 'all'
  onStageChange: (s: ApplicationStage | 'all') => void
  selectedMajors: string[]
  onChangeMajors: (v: string[]) => void
  selectedYears: number[]
  onChangeYears: (v: number[]) => void
  selectedRatings: Rating[]
  onChangeRatings: (v: Rating[]) => void
}) {
  const countByStage = (stage: ApplicationStage | 'all') =>
    stage === 'all'
      ? mockApplicants.length
      : mockApplicants.filter((a) => a.stage === stage).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Stage tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 px-4 py-3">
        {FILTER_STAGES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onStageChange(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStage === value
                ? 'bg-blue-50 text-brand-blue'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs text-gray-400">{countByStage(value)}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <FilterBar
        selectedMajors={selectedMajors} onChangeMajors={onChangeMajors}
        selectedYears={selectedYears} onChangeYears={onChangeYears}
        selectedRatings={selectedRatings} onChangeRatings={onChangeRatings}
      />

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Name', 'NUID', 'Email', 'Major', 'Year', 'Stage', 'Rating', 'Submitted'].map(
              (col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-xs font-medium tracking-wider text-gray-400 uppercase"
                >
                  {col}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {applicants.length > 0 ? (
            applicants.map((a) => <ApplicantRow key={a.id} applicant={a} />)
          ) : (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                No applicants found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanCard({ applicant }: { applicant: Applicant }) {
  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-gray-900">
        {applicant.firstName} {applicant.lastName}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{applicant.email}</p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="max-w-[130px] truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          {applicant.major}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          Year {applicant.year}
        </span>
        {applicant.rating && ratedStages.includes(applicant.stage) && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ratingBadge[applicant.rating]}`}>
            {ratingLabel[applicant.rating]}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ stage, applicants }: { stage: ApplicationStage; applicants: Applicant[] }) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${stageDot[stage]}`} />
        <span className="text-sm font-semibold text-gray-800">{stageLabel[stage]}</span>
        <span className="text-sm text-gray-400">{applicants.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {applicants.map((a) => <KanbanCard key={a.id} applicant={a} />)}
        {applicants.length === 0 && (
          <p className="px-1 text-xs text-gray-300">No applicants</p>
        )}
      </div>
    </div>
  )
}

function KanbanView({ applicants }: { applicants: Applicant[] }) {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {ORDERED_STAGES.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          applicants={applicants.filter((a) => a.stage === stage)}
        />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApplicantsPage() {
  const [view, setView] = useState<View>('table')
  const [activeStage, setActiveStage] = useState<ApplicationStage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedMajors, setSelectedMajors] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [selectedRatings, setSelectedRatings] = useState<Rating[]>([])

  const filtered = mockApplicants.filter((a) => {
    const matchesStage =
      view === 'kanban' || activeStage === 'all' || a.stage === activeStage
    const query = search.toLowerCase()
    const matchesSearch =
      !query ||
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(query) ||
      a.nuid.includes(query) ||
      a.email.toLowerCase().includes(query)
    const matchesMajor = selectedMajors.length === 0 || selectedMajors.includes(a.major)
    const matchesYear = selectedYears.length === 0 || selectedYears.includes(a.year)
    const matchesRating =
      selectedRatings.length === 0 ||
      (a.rating !== undefined && selectedRatings.includes(a.rating))
    return matchesStage && matchesSearch && matchesMajor && matchesYear && matchesRating
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Applicants</h1>

        <div className="flex items-center gap-3">
          <div className="relative w-60">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, NUID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-9 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-blue focus:outline-none"
            />
          </div>

          <div className="flex rounded-md border border-gray-200 bg-white">
            <button
              onClick={() => setView('table')}
              className={`rounded-l-md p-1.5 transition-colors ${
                view === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`rounded-r-md p-1.5 transition-colors ${
                view === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="Kanban view"
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'table' ? (
        <TableView
          applicants={filtered}
          activeStage={activeStage}
          onStageChange={setActiveStage}
          selectedMajors={selectedMajors} onChangeMajors={setSelectedMajors}
          selectedYears={selectedYears} onChangeYears={setSelectedYears}
          selectedRatings={selectedRatings} onChangeRatings={setSelectedRatings}
        />
      ) : (
        <KanbanView applicants={filtered} />
      )}
    </div>
  )
}
