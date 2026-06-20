'use client'

import { useState } from 'react'
import { Search, List, Columns } from 'lucide-react'
import type { ApplicationStage } from '@/lib/api/types'
import type { ApplicantApplication } from './types'
import { TableView } from './TableView'
import { KanbanView } from './KanbanView'

type View = 'table' | 'kanban'

export function ApplicantsClient({
  initialData,
}: {
  initialData: ApplicantApplication[]
}) {
  const [view, setView] = useState<View>('table')
  const [activeStage, setActiveStage] = useState<ApplicationStage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedMajors, setSelectedMajors] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])

  const allMajors = [
    ...new Set(
      initialData.map((a) => a.major).filter((m): m is string => m !== null),
    ),
  ].sort()
  const allYears = [
    ...new Set(
      initialData
        .map((a) => a.graduationYear)
        .filter((y): y is number => y !== null),
    ),
  ].sort((a, b) => a - b)

  const filtered = initialData.filter((a) => {
    const matchesStage =
      view === 'kanban' || activeStage === 'all' || a.stage === activeStage
    const query = search.toLowerCase()
    const matchesSearch =
      !query ||
      a.fullName.toLowerCase().includes(query) ||
      a.nuid.includes(query) ||
      a.email.toLowerCase().includes(query)
    const matchesMajor =
      selectedMajors.length === 0 ||
      (a.major !== null && selectedMajors.includes(a.major))
    const matchesYear =
      selectedYears.length === 0 ||
      (a.graduationYear !== null && selectedYears.includes(a.graduationYear))
    return matchesStage && matchesSearch && matchesMajor && matchesYear
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-text-default text-2xl font-semibold">Applicants</h1>

        <div className="flex items-center gap-3">
          <div className="relative w-60">
            <Search className="text-text-subtle absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, NUID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-9 text-sm focus:outline-none"
            />
          </div>

          <div className="flex rounded-md border border-gray-200 bg-white">
            <button
              onClick={() => setView('table')}
              className={`rounded-l-md p-1.5 transition-colors ${
                view === 'table'
                  ? 'text-text-default bg-gray-100'
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
                  ? 'text-text-default bg-gray-100'
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
          allApplicants={initialData}
          activeStage={activeStage}
          onStageChange={setActiveStage}
          allMajors={allMajors}
          selectedMajors={selectedMajors}
          onChangeMajors={setSelectedMajors}
          allYears={allYears}
          selectedYears={selectedYears}
          onChangeYears={setSelectedYears}
        />
      ) : (
        <KanbanView applicants={filtered} />
      )}
    </div>
  )
}
