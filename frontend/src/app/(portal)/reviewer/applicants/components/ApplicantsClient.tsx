'use client'

import { useMemo, useState } from 'react'
import { Search, List, Columns } from 'lucide-react'
import type { ApplicationStage, Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useCycles } from '@/lib/queries/cycles'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import type { ApplicantApplication } from './types'
import { TableView } from './TableView'
import { KanbanView } from './KanbanView'

type View = 'table' | 'kanban'

const SELECT_CLASS =
  'h-8 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-text-default focus:border-brand-blue focus:outline-none'

export function ApplicantsClient() {
  const [view, setView] = useState<View>('table')
  const [activeStage, setActiveStage] = useState<ApplicationStage | 'all'>(
    'all'
  )
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')
  const [activeCycle, setActiveCycle] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedMajors, setSelectedMajors] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])

  const { data: applications = [] } = useApplications({})
  const { data: cycles = [] } = useCycles({})

  const uniqueNUIDs = useMemo(
    () => [...new Set(applications.map((a) => a.user_nuid))],
    [applications]
  )
  const applicantQueries = useApplicantsByNuids(uniqueNUIDs)
  const byNUID = useMemo(() => {
    const map: Record<string, (typeof applicantQueries)[number]['data']> = {}
    for (const q of applicantQueries) {
      if (q.data) map[q.data.nuid] = q.data
    }
    return map
  }, [applicantQueries])

  const rows: ApplicantApplication[] = useMemo(
    () =>
      applications.map((app) => {
        const person = byNUID[app.user_nuid]
        return {
          id: app.id,
          fullName: person?.full_name ?? app.user_nuid,
          nuid: app.user_nuid,
          email: person?.email ?? '',
          major: person?.major ?? null,
          graduationYear: person?.graduation_year ?? null,
          role: app.role,
          cycleId: app.cycle_id,
          stage: app.stage,
          submittedAt: app.submitted_at,
        }
      }),
    [applications, byNUID]
  )

  const allMajors = [
    ...new Set(rows.map((a) => a.major).filter((m): m is string => m !== null)),
  ].sort()
  const allYears = [
    ...new Set(
      rows.map((a) => a.graduationYear).filter((y): y is number => y !== null)
    ),
  ].sort((a, b) => a - b)

  const filtered = rows.filter((a) => {
    const matchesStage =
      view === 'kanban' || activeStage === 'all' || a.stage === activeStage
    const matchesRole = activeRole === 'all' || a.role === activeRole
    const matchesCycle = activeCycle === 'all' || a.cycleId === activeCycle
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
    return (
      matchesStage &&
      matchesRole &&
      matchesCycle &&
      matchesSearch &&
      matchesMajor &&
      matchesYear
    )
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-text-default text-2xl font-semibold">Applicants</h1>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by role"
            className={SELECT_CLASS}
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value as Role | 'all')}
          >
            <option value="all">All roles</option>
            {ROLE_COLUMNS.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by cycle"
            className={SELECT_CLASS}
            value={activeCycle}
            onChange={(e) => setActiveCycle(e.target.value)}
          >
            <option value="all">All cycles</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-60">
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
          allApplicants={rows}
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
