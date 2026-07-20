'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Folder } from 'lucide-react'
import type { Cycle } from '@/lib/api/types'
import {
  useCycles,
  useCycleTemplateSummariesByCycles,
} from '@/lib/queries/cycles'
import { ROLE_COLUMNS } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import type { ApplicationTemplateCard } from './types'
import { ApplicationRow } from './ApplicationRow'

const OPTS = { actor: REVIEWER_ACTOR }

export function ApplicationsClient() {
  const { data: cycles = [] } = useCycles({}, OPTS)

  // Default the board to the open cycle so it doesn't grow without bound as
  // cycles pile up; older cycles collapse into a "Past cycles" folder.
  const currentCycleId = useMemo(() => {
    const open = cycles.find((c) => c.status === 'open')
    if (open) return open.id
    return [...cycles].sort((a, b) =>
      (b.opens_at ?? b.created_at).localeCompare(a.opens_at ?? a.created_at)
    )[0]?.id
  }, [cycles])

  const cycleIds = useMemo(() => cycles.map((c) => c.id), [cycles])
  const summaryQueries = useCycleTemplateSummariesByCycles(cycleIds, OPTS)
  const summaryByCycle = useMemo(() => {
    const map: Record<string, (typeof summaryQueries)[number]['data']> = {}
    cycleIds.forEach((id, i) => {
      map[id] = summaryQueries[i]?.data
    })
    return map
  }, [cycleIds, summaryQueries])

  const templatesByCycle = useMemo(() => {
    const map: Record<string, ApplicationTemplateCard[]> = {}
    cycles.forEach((cycle, cycleColorIndex) => {
      const summaries = summaryByCycle[cycle.id] ?? []
      map[cycle.id] = ROLE_COLUMNS.map((role) => {
        const summary = summaries.find((s) => s.role === role)
        return {
          cycleId: cycle.id,
          cycleName: cycle.name,
          cycleStatus: cycle.status,
          cycleColorIndex,
          opensAt: cycle.opens_at ?? null,
          closesAt: cycle.closes_at ?? null,
          role,
          questionCount: summary?.question_count ?? 0,
          challengeCount: summary?.challenge_count ?? 0,
          submissionCount: summary?.submission_count ?? 0,
        }
      })
    })
    return map
  }, [cycles, summaryByCycle])

  const currentTemplates = currentCycleId
    ? (templatesByCycle[currentCycleId] ?? [])
    : []
  const pastCycles = useMemo(
    () =>
      [...cycles]
        .filter((c) => c.id !== currentCycleId)
        .sort((a, b) =>
          (b.opens_at ?? b.created_at).localeCompare(a.opens_at ?? a.created_at)
        ),
    [cycles, currentCycleId]
  )

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-text-default text-2xl font-semibold">Applications</h1>

      {cycles.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No cycles yet — create one from the Cycles page.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {currentTemplates.map((t) => (
            <ApplicationRow key={`${t.cycleId}-${t.role}`} template={t} />
          ))}
        </div>
      )}

      {pastCycles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            Past cycles
          </h2>
          {pastCycles.map((cycle) => (
            <PastCycleFolder
              key={cycle.id}
              cycle={cycle}
              templates={templatesByCycle[cycle.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PastCycleFolder({
  cycle,
  templates,
}: {
  cycle: Cycle
  templates: ApplicationTemplateCard[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight
          size={16}
          className={`text-text-faint shrink-0 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
        <Folder size={16} className="text-text-faint shrink-0" />
        <span className="text-text-default text-sm font-medium">
          {cycle.name}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 border-t border-gray-100 p-4 pt-3">
          {templates.map((t) => (
            <ApplicationRow key={`${t.cycleId}-${t.role}`} template={t} />
          ))}
        </div>
      )}
    </div>
  )
}
