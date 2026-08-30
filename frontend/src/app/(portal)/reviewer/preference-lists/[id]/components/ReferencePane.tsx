'use client'

import { Plus } from 'lucide-react'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import type { Role } from '@/lib/api/types'
import type { PreferenceEntry } from './EntryRow'

// A second list shown beside the one being edited. Read-only by design —
// reconciling personal picks into the group list is the whole point of a
// preference group, and doing it from memory across a dropdown was the part
// that made this page hard to use.
export function ReferencePane({
  title,
  role,
  entries,
  presentIds,
  canAdd,
  onAdd,
  availabilityBadgeFor,
  draftedByApplicationId,
  emptyText,
}: {
  title: string
  role: Role
  entries: PreferenceEntry[]
  // Application ids already on the list being edited — the rest get an Add.
  presentIds: Set<string>
  canAdd: boolean
  onAdd: (applicationId: string) => void
  availabilityBadgeFor: (
    applicationId: string,
    role: Role
  ) => { label: string; className: string } | undefined
  draftedByApplicationId: Record<string, string | undefined>
  emptyText: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-text-default text-sm font-semibold">{title}</span>
        <span className="text-text-faint text-xs">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-text-faint text-sm">{emptyText}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => {
            const already = presentIds.has(entry.application_id)
            const badge = availabilityBadgeFor(entry.application_id, role)
            const draftedBy = draftedByApplicationId[entry.application_id]
            return (
              <li
                key={entry.id}
                className={`flex items-start gap-2 rounded-lg border border-gray-200 p-3 ${
                  already ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <span className="text-text-subtle w-5 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-sm font-medium ${
                        draftedBy
                          ? 'text-text-faint line-through'
                          : 'text-text-default'
                      }`}
                    >
                      {entry.full_name}
                    </span>
                    {entry.returner && <ReturnerBadge />}
                    {draftedBy && (
                      <span className="text-text-muted rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium">
                        Drafted · {draftedBy}
                      </span>
                    )}
                    {badge && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {entry.reasoning && (
                    <p className="text-text-subtle mt-0.5 text-xs">
                      {entry.reasoning}
                    </p>
                  )}
                </div>
                {already ? (
                  <span className="text-text-faint shrink-0 text-[10px]">
                    On list
                  </span>
                ) : (
                  canAdd && (
                    <button
                      type="button"
                      onClick={() => onAdd(entry.application_id)}
                      aria-label={`Add ${entry.full_name} to the list you're editing`}
                      className="text-brand-blue hover:text-brand-blue/80 inline-flex shrink-0 items-center gap-0.5 text-xs"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
