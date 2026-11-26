'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { useApplications } from '@/lib/queries/applications'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import { usePreferenceListDetails } from '@/lib/queries/preference-lists'
import { useCycleTags } from '@/lib/queries/tags'
import { TagPill } from '@/components/ui/tag-select'
import { cn } from '@/lib/utils'
import { ApplicationDetail } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicationDetail'
import { matchesWanted, type ListAction } from './AddToMyList'
import type { ApplicationListParams } from '@/lib/queries/applications'
import { useCycleHref } from '@/hooks/useCycleHref'

const RATING_ORDER = ['must_hire', 'great', 'good', 'neutral', 'do_not_hire']

export function CompareTable({
  cycleId,
  roleId,
  filterParams,
  filtered,
  search = '',
  listAction,
  wanted = [],
  fullPageHref,
}: {
  cycleId: string
  roleId: string
  filterParams: ApplicationListParams
  filtered: boolean
  search?: string
  listAction?: ListAction
  wanted?: string[]
  fullPageHref?: (applicationId: string) => string
}) {
  const toCycle = useCycleHref()
  const { data: fetched = [], isLoading } = useApplications(
    { cycle_id: cycleId, ...filterParams, stages: 'selection' },
    undefined,
    { enabled: !!cycleId && !!roleId }
  )
  const ids = useMemo(() => fetched.map((a) => a.id), [fetched])
  const q = search.trim().toLowerCase()
  const apps = useMemo(
    () =>
      q
        ? fetched.filter((a) =>
            (a.full_name || a.user_nuid).toLowerCase().includes(q)
          )
        : fetched,
    [fetched, q]
  )
  const { data: interviews = {}, isLoading: interviewsLoading } =
    useInterviewsByApplicationIds(ids)
  const { data: teams = [], isLoading: teamsLoading } =
    usePreferenceListDetails(cycleId)
  const [open, setOpen] = useState<string | null>(null)
  const { data: tags = [] } = useCycleTags(cycleId)
  const tagById = new Map(tags.map((t) => [t.id, t]))

  const rows = useMemo(() => {
    const rankOf = new Map<string, Map<string, number>>()
    for (const t of teams) {
      for (const e of t.entries ?? []) {
        if (e.role_id !== roleId) continue
        if (!rankOf.has(e.application_id))
          rankOf.set(e.application_id, new Map())
        rankOf.get(e.application_id)!.set(t.id, e.rank)
      }
    }
    return apps
      .map((a) => {
        const ranks = rankOf.get(a.id) ?? new Map<string, number>()
        const rating = interviews[a.id]?.rating
        return {
          app: a,
          ranks,
          rating,
          wanted: ranks.size,
          best: ranks.size ? Math.min(...ranks.values()) : Infinity,
        }
      })
      .sort(
        (x, y) =>
          y.wanted - x.wanted ||
          x.best - y.best ||
          RATING_ORDER.indexOf(x.rating ?? '') -
            RATING_ORDER.indexOf(y.rating ?? '') ||
          x.app.full_name.localeCompare(y.app.full_name)
      )
  }, [apps, teams, interviews, roleId])

  const visible = rows.filter((r) => matchesWanted(r.wanted, wanted))
  const myListId = listAction?.listId
  const columns = [
    ...teams.filter((t) => t.id === myListId),
    ...teams.filter((t) => t.id !== myListId),
  ]
  const opened = apps.find((a) => a.id === open)

  if (isLoading || teamsLoading || interviewsLoading) {
    return (
      <>
        <div role="status" aria-label="Loading" className={TABLE_FRAME}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-6 border-b border-gray-200 px-4 py-4 last:border-b-0"
            >
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </>
    )
  }
  if (apps.length === 0) {
    return filtered || q ? (
      <>
        <EmptyState title="No one matches" />
      </>
    ) : (
      <EmptyState title="No one is in Decisions for this position yet" />
    )
  }
  if (teams.length === 0) {
    return <EmptyState title="No teams yet" />
  }

  return (
    <>
      <div className={cn(TABLE_FRAME, 'overscroll-x-none')}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className={cn(
                  TABLE_HEAD,
                  'sticky left-0 z-10 min-w-72 text-left'
                )}
              >
                Applicant
              </th>
              <th className={cn(TABLE_HEAD, 'min-w-32 text-left')}>
                Interview
              </th>
              {columns.map((t) => {
                const mine = t.id === myListId
                return (
                  <th
                    key={t.id}
                    className={cn(
                      TABLE_HEAD,
                      'max-w-36 min-w-28 text-center',
                      mine && 'text-ink bg-gray-100'
                    )}
                  >
                    <Link
                      href={toCycle(`/cycle/teams/${t.id}`)}
                      className="hover:text-ink block truncate"
                      title={t.name}
                    >
                      {t.name}
                    </Link>
                    {mine && (
                      <span className="text-text-muted block text-[10px] normal-case">
                        your team
                      </span>
                    )}
                  </th>
                )
              })}
              <th className={cn(TABLE_HEAD, 'min-w-28 text-right')}>
                Ranked by
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 3}
                  className="text-text-subtle px-4 py-10 text-center"
                >
                  No one here.
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const tone = r.rating ? RATING_COLORS[r.rating] : null
                return (
                  <tr
                    key={r.app.id}
                    onClick={() => setOpen(r.app.id)}
                    className="group cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="sticky left-0 z-10 min-w-72 bg-white px-4 py-2.5 group-hover:bg-gray-50">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="text-ink font-medium">
                          {r.app.full_name}
                        </span>
                        {(r.app.tag_ids ?? []).map((t) => {
                          const tag = tagById.get(t)
                          return tag ? <TagPill key={t} tag={tag} /> : null
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.rating && tone ? (
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                            tone.bg,
                            tone.text
                          )}
                        >
                          {RATING_LABEL[r.rating]}
                        </span>
                      ) : (
                        <span className="text-text-faint text-xs">—</span>
                      )}
                    </td>
                    {columns.map((t) => {
                      const rank = r.ranks.get(t.id)
                      return (
                        <td
                          key={t.id}
                          className={cn(
                            'px-2 py-2.5 text-center',
                            t.id === myListId && 'bg-gray-50'
                          )}
                        >
                          {t.id === myListId && listAction ? (
                            listAction.render(r.app.id, 'cell')
                          ) : rank === undefined ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex h-7 min-w-7 items-center justify-center px-1.5 text-xs tabular-nums',
                                rank <= 2
                                  ? 'bg-ink font-semibold text-white'
                                  : 'text-ink bg-gray-100'
                              )}
                            >
                              {rank}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums',
                        r.wanted > 1
                          ? 'font-semibold text-orange-600'
                          : r.wanted === 0
                            ? 'text-text-faint'
                            : 'text-text-muted'
                      )}
                    >
                      {r.wanted === 0
                        ? 'No team'
                        : `${r.wanted} team${r.wanted === 1 ? '' : 's'}`}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {opened && (
        <ApplicationDetail
          applicant={{
            id: opened.id,
            nuid: opened.user_nuid,
            fullName: opened.full_name,
            email: opened.email,
            role: opened.role_id,
            cycleId,
            stage: opened.stage,
            submittedAt: opened.submitted_at,
            returner: !!opened.returner,
          }}
          fullPageHref={fullPageHref?.(opened.id)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
