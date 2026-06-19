'use client'

import { useState } from 'react'
import { Search, List, Columns } from 'lucide-react'
import { mockApplicants } from '@/lib/mock-applicants'
import type { ApplicationStage, Rating } from '@/types/applicant'
import { TableView } from './components/TableView'
import { KanbanView } from './components/KanbanView'

type View = 'table' | 'kanban'

export default function ApplicantsPage() {
  const [view, setView] = useState<View>('table')
  const [activeStage, setActiveStage] = useState<ApplicationStage | 'all'>(
    'all'
  )
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
    const matchesMajor =
      selectedMajors.length === 0 || selectedMajors.includes(a.major)
    const matchesYear =
      selectedYears.length === 0 || selectedYears.includes(a.year)
    const matchesRating =
      selectedRatings.length === 0 ||
      (a.rating !== undefined && selectedRatings.includes(a.rating))
    return (
      matchesStage &&
      matchesSearch &&
      matchesMajor &&
      matchesYear &&
      matchesRating
    )
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-default">Applicants</h1>

        <div className="flex items-center gap-3">
          <div className="relative w-60">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Search name, NUID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:border-brand-blue w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-9 text-sm text-text-default placeholder:text-text-subtle focus:outline-none"
            />
          </div>

          <div className="flex rounded-md border border-gray-200 bg-white">
            <button
              onClick={() => setView('table')}
              className={`rounded-l-md p-1.5 transition-colors ${
                view === 'table'
                  ? 'bg-gray-100 text-text-default'
                  : 'text-text-subtle hover:text-text-secondary'
              }`}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`rounded-r-md p-1.5 transition-colors ${
                view === 'kanban'
                  ? 'bg-gray-100 text-text-default'
                  : 'text-text-subtle hover:text-text-secondary'
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
          selectedMajors={selectedMajors}
          onChangeMajors={setSelectedMajors}
          selectedYears={selectedYears}
          onChangeYears={setSelectedYears}
          selectedRatings={selectedRatings}
          onChangeRatings={setSelectedRatings}
        />
      ) : (
        <KanbanView applicants={filtered} />
      )}
    </div>
  )
}
