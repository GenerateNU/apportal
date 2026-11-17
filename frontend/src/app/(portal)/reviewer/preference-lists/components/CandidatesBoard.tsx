'use client'

import { useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TagPill } from '@/components/ui/tag-select'
import type { InterviewRating } from '@/lib/api/types'
import { RATING_COLORS, RATING_OPTIONS } from '@/lib/interview-ratings'
import { useApplications } from '@/lib/queries/applications'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import { usePreferenceListDetails } from '@/lib/queries/preference-lists'
import { useCycleTags } from '@/lib/queries/tags'
import { cn } from '@/lib/utils'
import { ApplicationDetail } from '../../applications/components/ApplicationDetail'

type Want = { team: string; rank: number }

const COLUMNS: { value: InterviewRating | 'unrated'; label: string }[] = [
  ...RATING_OPTIONS,
  { value: 'unrated', label: 'No rating' },
]

// Who's in Decisions for one position, by interview rating, with how many teams ranked each.
export function CandidatesBoard({
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
  const { data: interviews = {} } = useInterviewsByApplicationIds(ids)
  const { data: lists = [] } = usePreferenceListDetails(cycleId)
  const { data: tags = [] } = useCycleTags(cycleId)
  const [open, setOpen] = useState<string | null>(null)

  const wants = useMemo(() => {
    const m = new Map<string, Want[]>()
    for (const l of lists) {
      for (const e of l.entries ?? []) {
        if (e.role_id !== roleId) continue
        m.set(e.application_id, [
          ...(m.get(e.application_id) ?? []),
          { team: l.name, rank: e.rank },
        ])
      }
    }
    return m
  }, [lists, roleId])
  const tagById = new Map(tags.map((t) => [t.id, t]))

  if (!isLoading && apps.length === 0) {
    return (
      <EmptyState
        title="No one is in Decisions for this position yet"
        description="Advance applicants from Interviews and they'll show up here."
      />
    )
  }

  const ratingOf = (id: string) => interviews[id]?.rating ?? 'unrated'
  const opened = apps.find((a) => a.id === open)

  return (
    <>
      <div className="grid min-h-0 grid-cols-[repeat(6,minmax(13rem,1fr))] gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const cards = apps.filter((a) => ratingOf(a.id) === col.value)
          if (col.value === 'unrated' && cards.length === 0) return null
          const tone = col.value === 'unrated' ? null : RATING_COLORS[col.value]
          return (
            <section key={col.value} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium',
                    tone
                      ? `${tone.bg} ${tone.text}`
                      : 'text-text-muted bg-gray-100'
                  )}
                >
                  {col.label}
                </span>
                <span className="text-text-subtle text-xs tabular-nums">
                  {cards.length}
                </span>
              </div>
              <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
                {cards.map((a) => {
                  const w = (wants.get(a.id) ?? []).sort(
                    (x, y) => x.rank - y.rank
                  )
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpen(a.id)}
                      className="flex flex-col gap-1.5 border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ink truncate text-sm font-medium">
                          {a.full_name}
                        </span>
                        {w.length > 1 && (
                          <Flame
                            size={13}
                            className="shrink-0 text-orange-500"
                            aria-label="Wanted by more than one team"
                          />
                        )}
                      </span>
                      <span className="text-text-muted text-xs">
                        {w.length === 0
                          ? 'No team has ranked them'
                          : `${w.length} team${w.length === 1 ? '' : 's'} · #${w[0].rank} ${w[0].team}`}
                      </span>
                      {(a.tag_ids ?? []).length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {(a.tag_ids ?? []).map((t) => {
                            const tag = tagById.get(t)
                            return tag ? <TagPill key={t} tag={tag} /> : null
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
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
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
