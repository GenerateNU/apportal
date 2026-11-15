'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { PreferenceListDetail } from '@/lib/api/types'
import { cn } from '@/lib/utils'

export function MostWanted({
  groups,
  myListIds,
  roleIds,
  roleLabel,
}: {
  groups: PreferenceListDetail[]
  myListIds: Set<string>
  roleIds: string[]
  roleLabel: (id: string) => string
}) {
  const [showAll, setShowAll] = useState(false)
  if (groups.length < 2) return null
  const rows = new Map<
    string,
    {
      name: string
      roleId: string
      ranks: number[]
      teams: string[]
      ours?: number
    }
  >()
  for (const g of groups) {
    for (const roleId of roleIds) {
      ;(g.entries ?? [])
        .filter((e) => e.role_id === roleId)
        .sort((a, b) => a.rank - b.rank)
        .forEach((e, i) => {
          const key = `${e.application_id}:${roleId}`
          const row = rows.get(key) ?? {
            name: e.full_name,
            roleId,
            ranks: [],
            teams: [],
          }
          row.ranks.push(i + 1)
          row.teams.push(g.name)
          if (myListIds.has(g.id)) row.ours = i + 1
          rows.set(key, row)
        })
    }
  }
  const all = [...rows.entries()]
    .map(([key, r]) => ({
      key,
      ...r,
      avg: r.ranks.reduce((a, b) => a + b, 0) / r.ranks.length,
    }))
    .sort(
      (a, b) =>
        b.ranks.length - a.ranks.length ||
        a.avg - b.avg ||
        a.name.localeCompare(b.name)
    )
  if (all.length === 0) return null
  const contestedAt = Math.max(2, Math.ceil(groups.length / 2))
  const shown = showAll ? all : all.slice(0, 10)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
          Most wanted
        </h2>
        <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
          Across {groups.length} teams
        </span>
      </div>
      <div className="overflow-x-auto border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead>
            <tr className="font-display text-ink/60 border-b border-gray-200 bg-gray-50 text-left text-[11px] tracking-wider uppercase">
              <th className="px-4 py-2.5 font-normal">Applicant</th>
              <th className="px-4 py-2.5 font-normal">Wanted by</th>
              <th className="px-4 py-2.5 font-normal">Avg rank</th>
              <th className="px-4 py-2.5 text-right font-normal">Ours</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-200 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <span className="text-ink block font-semibold wrap-anywhere">
                    {row.name}
                  </span>
                  {roleIds.length > 1 && (
                    <span className="text-text-muted text-xs">
                      {roleLabel(row.roleId)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex gap-0.5" aria-hidden>
                      {groups.map((g, i) => (
                        <span
                          key={g.id}
                          className={cn(
                            'h-3.5 w-1.5',
                            i < row.ranks.length ? 'bg-ink' : 'bg-gray-200'
                          )}
                        />
                      ))}
                    </span>
                    <span className="text-ink font-semibold">
                      {row.ranks.length}
                    </span>
                    {row.ranks.length >= contestedAt && (
                      <Badge size="sm" className="bg-red-50 text-red-700">
                        Contested
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-muted mt-1 text-xs wrap-anywhere">
                    {row.teams.join(', ')}
                  </p>
                </td>
                <td className="text-ink px-4 py-3">
                  {row.avg.toFixed(1)}
                  <span className="text-text-muted ml-1 text-xs">
                    best #{Math.min(...row.ranks)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.ours ? (
                    <span className="font-display text-ink font-bold">
                      #{row.ours}
                    </span>
                  ) : (
                    <span className="text-text-subtle">Not ranked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {all.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-text-muted hover:text-ink self-start text-sm underline-offset-2 hover:underline"
        >
          {showAll ? 'Show top 10' : `Show all ${all.length}`}
        </button>
      )}
    </section>
  )
}
