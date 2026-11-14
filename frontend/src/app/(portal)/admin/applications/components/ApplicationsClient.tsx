'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { ChevronRight, Folder } from 'lucide-react'
import type { Cycle } from '@/lib/api/types'
import { useApplicationTemplatesByCycleRoles } from '@/lib/queries/application-templates'
import {
  useCycles,
  useCycleTemplateSummariesByCycles,
} from '@/lib/queries/cycles'
import type { ApplicationTemplateCard } from './types'
import { cycleStatusDot, cycleStatusLabel } from './constants'
import { ApplicationRow } from './ApplicationRow'
import { useRoleLookup } from '@/lib/queries/roles'

function byRecency(a: Cycle, b: Cycle) {
  return (b.opens_at ?? b.created_at).localeCompare(a.opens_at ?? a.created_at)
}

export function ApplicationsClient() {
  const { data: cycles = [] } = useCycles({})
  const { roleLabel } = useRoleLookup()

  // Open cycles stay expanded as a flat grid up top. Draft and past
  // (closed/archived) cycles each collapse into their own folder so the
  // board doesn't grow without bound as cycles pile up.
  const openCycles = useMemo(
    () => [...cycles].filter((c) => c.status === 'open').sort(byRecency),
    [cycles]
  )
  const draftCycles = useMemo(
    () => [...cycles].filter((c) => c.status === 'draft').sort(byRecency),
    [cycles]
  )
  const pastCycles = useMemo(
    () =>
      [...cycles]
        .filter((c) => c.status === 'closed' || c.status === 'archived')
        .sort(byRecency),
    [cycles]
  )

  const cycleIds = useMemo(() => cycles.map((c) => c.id), [cycles])
  const summaryQueries = useCycleTemplateSummariesByCycles(cycleIds)
  const summaryByCycle = useMemo(() => {
    const map: Record<string, (typeof summaryQueries)[number]['data']> = {}
    cycleIds.forEach((id, i) => {
      map[id] = summaryQueries[i]?.data
    })
    return map
  }, [cycleIds, summaryQueries])

  // A cycle's summaries carry one entry per role of the cycle.
  const cycleRolePairs = useMemo(
    () =>
      cycleIds.flatMap((cycleId) =>
        (summaryByCycle[cycleId] ?? []).map((s) => ({
          cycleId,
          roleId: s.role_id,
        }))
      ),
    [cycleIds, summaryByCycle]
  )
  const templateQueries = useApplicationTemplatesByCycleRoles(cycleRolePairs)
  const templateByCycleRole = useMemo(() => {
    const map: Record<string, (typeof templateQueries)[number]['data']> = {}
    cycleRolePairs.forEach(({ cycleId, roleId }, i) => {
      map[`${cycleId}-${roleId}`] = templateQueries[i]?.data
    })
    return map
  }, [cycleRolePairs, templateQueries])

  const templatesByCycle = useMemo(() => {
    const map: Record<string, ApplicationTemplateCard[]> = {}
    cycles.forEach((cycle, cycleColorIndex) => {
      const summaries = summaryByCycle[cycle.id] ?? []
      map[cycle.id] = summaries.map((summary) => {
        const role = summary.role_id
        const template = templateByCycleRole[`${cycle.id}-${role}`]
        return {
          cycleId: cycle.id,
          cycleName: cycle.name,
          cycleStatus: cycle.status,
          cycleColorIndex,
          role,
          title: template?.title ?? `${roleLabel(role)} Application`,
          status: template?.status ?? 'draft',
          questionCount: summary.question_count,
          challengeCount: summary.challenge_count,
          submissionCount: summary.submission_count,
        }
      })
    })
    return map
  }, [cycles, summaryByCycle, templateByCycleRole, roleLabel])

  const openTemplates = useMemo(
    () => openCycles.flatMap((cycle) => templatesByCycle[cycle.id] ?? []),
    [openCycles, templatesByCycle]
  )

  return (
    <PageContainer>
      <h1 className="text-text-default text-2xl font-semibold">Applications</h1>

      {cycles.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No cycles yet — create one from the Cycles page.
        </p>
      ) : openCycles.length === 0 && draftCycles.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No open or draft cycles right now.
        </p>
      ) : (
        <>
          {openCycles.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
                Open cycles
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4">
                {openTemplates.map((t) => (
                  <ApplicationRow key={`${t.cycleId}-${t.role}`} template={t} />
                ))}
              </div>
            </div>
          )}

          {draftCycles.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
                Draft cycles
              </h2>
              {draftCycles.map((cycle) => (
                <CycleFolder
                  key={cycle.id}
                  cycle={cycle}
                  templates={templatesByCycle[cycle.id] ?? []}
                />
              ))}
            </div>
          )}
        </>
      )}

      {pastCycles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            Past cycles
          </h2>
          {pastCycles.map((cycle) => (
            <CycleFolder
              key={cycle.id}
              cycle={cycle}
              templates={templatesByCycle[cycle.id] ?? []}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function CycleFolder({
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
        <span className="text-text-default min-w-0 truncate text-sm font-medium">
          {cycle.name}
        </span>
        <span className="text-text-subtle flex shrink-0 items-center gap-1.5 text-xs">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${cycleStatusDot[cycle.status]}`}
          />
          {cycleStatusLabel[cycle.status]}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4 border-t border-gray-100 p-4 pt-3">
          {templates.map((t) => (
            <ApplicationRow key={`${t.cycleId}-${t.role}`} template={t} />
          ))}
        </div>
      )}
    </div>
  )
}
