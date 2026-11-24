'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_HEAD } from '@/components/ui/table-styles'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { useApplications } from '@/lib/queries/applications'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import { usePreferenceListDetails } from '@/lib/queries/preference-lists'
import { cn } from '@/lib/utils'
import { ApplicationDetail } from '../../applications/components/ApplicationDetail'

type Filter = 'all' | 'contested' | 'unranked'

const RATING_ORDER = ['must_hire', 'great', 'good', 'neutral', 'do_not_hire']

export function CompareTable({
  cycleId,
  roleId,
}: {
  cycleId: string
  roleId: string
}) {
  const { data: apps = [], isLoading } = useApplications(
    { cycle_id: cycleId, role_id: roleId, stages: 'selection' },
    undefined,
    { enabled: !!cycleId && !!roleId }
  )
  const ids = useMemo(() => apps.map((a) => a.id), [apps])
  const { data: interviews = {}, isLoading: interviewsLoading } =
    useInterviewsByApplicationIds(ids)
  const { data: teams = [], isLoading: teamsLoading } =
    usePreferenceListDetails(cycleId)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)

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

  const contested = rows.filter((r) => r.wanted > 1).length
  const unranked = rows.filter((r) => r.wanted === 0).length
  const visible = rows.filter((r) =>
    filter === 'contested'
      ? r.wanted > 1
      : filter === 'unranked'
        ? r.wanted === 0
        : true
  )
  const opened = apps.find((a) => a.id === open)

  if (isLoading || teamsLoading || interviewsLoading) {
    return (
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
    )
  }
  if (apps.length === 0) {
    return <EmptyState title="No one is in Decisions for this position yet" />
  }
  if (teams.length === 0) {
    return <EmptyState title="No teams yet" />
  }

  return (
    <>
      <SegmentedTabs<Filter>
        className="h-9 w-fit"
        tabs={[
          { id: 'all', label: 'All', count: rows.length },
          { id: 'contested', label: 'Wanted by 2+', count: contested },
          { id: 'unranked', label: 'Not ranked', count: unranked },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className={TABLE_FRAME}>
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr>
              <th className={cn(TABLE_HEAD, 'text-left')}>Applicant</th>
              <th className={cn(TABLE_HEAD, 'w-32 text-left')}>Interview</th>
              {teams.map((t) => (
                <th key={t.id} className={cn(TABLE_HEAD, 'w-28 text-center')}>
                  <Link
                    href={`/reviewer/preference-lists/${t.id}`}
                    className="hover:text-ink block truncate"
                    title={t.name}
                  >
                    {t.name}
                  </Link>
                </th>
              ))}
              <th className={cn(TABLE_HEAD, 'w-24 text-right')}>Teams</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={teams.length + 3}
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
                    className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-ink font-medium">
                        {r.app.full_name}
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
                    {teams.map((t) => {
                      const rank = r.ranks.get(t.id)
                      return (
                        <td key={t.id} className="px-2 py-2.5 text-center">
                          {rank === undefined ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex h-7 min-w-7 items-center justify-center px-1.5 text-xs tabular-nums',
                                rank <= 3
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
                      {r.wanted}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-text-subtle text-xs">
        Numbers are each team&apos;s rank. Dark means top 3.
      </p>

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
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
