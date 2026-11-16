'use client'

import { useState } from 'react'
import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail } from '@/lib/api/client'
import { useApplications } from '@/lib/queries/applications'
import { stepConfig, useCycleSteps } from '@/lib/queries/pipeline'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import { useUsers } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import {
  useReviewConflicts,
  useSetConflict,
  useStaffing,
  useStaffingMutations,
} from '@/lib/queries/reviewer-pools'

export type Lead = { nuid: string; name: string }

type Person = { nuid: string; name: string; chief: boolean }

function useTeam(cycleId: string) {
  const { data: staff = [] } = useCycleStaff(cycleId)
  const { data: users = [] } = useUsers()
  const { data } = useStaffing(cycleId)
  const m = useStaffingMutations(cycleId)
  const toast = useToast()
  const chiefs = new Set(
    staff.filter((s) => s.role === 'chief').map((s) => s.user_nuid)
  )
  const people: Person[] = users.map((u) => ({
    nuid: u.nuid,
    name: u.full_name,
    chief: chiefs.has(u.nuid),
  }))
  const label = (nuid: string) => {
    const p = people.find((x) => x.nuid === nuid)
    return p ? `${p.name}${p.chief ? ' (chief)' : ''}` : nuid
  }
  async function run(p: Promise<unknown>) {
    try {
      await p
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }
  return {
    groups: data?.categories ?? [],
    positions: data?.positions ?? [],
    people,
    label,
    m,
    run,
  }
}

export function GroupsGrid({
  cycleId,
  header,
}: {
  cycleId: string
  header: React.ReactNode
}) {
  const { groups, people, label, m, run } = useTeam(cycleId)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const personOf = (nuid: string) => people.find((p) => p.nuid === nuid)

  async function create() {
    const name = newName.trim()
    setNewName('')
    setAdding(false)
    if (name) await run(m.createCategory.mutateAsync(name))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        {header}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-text-muted hover:text-ink hover:border-ink flex shrink-0 items-center gap-1 border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium transition-colors"
          >
            <Plus size={14} /> New group
          </button>
        )}
      </div>
      {groups.length === 0 && !adding && (
        <p className="text-text-subtle text-sm">No groups yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.id}
            className="group flex flex-col border border-gray-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <span className="text-ink truncate font-semibold">{g.name}</span>
              <span className="flex items-center gap-1">
                <span className="text-text-subtle text-xs tabular-nums">
                  {g.member_nuids.length}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => run(m.deleteCategory.mutateAsync(g.id))}
                  className="text-text-faint hover:text-ink p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 px-4 py-2.5">
              {g.member_nuids.length === 0 && (
                <span className="text-text-subtle text-sm">No one yet</span>
              )}
              {g.member_nuids.map((n) => {
                const p = personOf(n)
                return (
                  <div
                    key={n}
                    className="group/row flex items-center gap-2.5 py-0.5 text-sm"
                  >
                    <span className="text-ink flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold">
                      {initialsOf(p?.name ?? n)}
                    </span>
                    <span className="text-ink min-w-0 flex-1 truncate">
                      {p?.name ?? n}
                    </span>
                    {p?.chief && (
                      <span className="font-display text-text-subtle text-[10px] tracking-wider uppercase">
                        Chief
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${label(n)}`}
                      onClick={() =>
                        run(
                          m.updateCategory.mutateAsync({
                            id: g.id,
                            members: g.member_nuids.filter((x) => x !== n),
                          })
                        )
                      }
                      className="text-text-faint hover:text-ink p-0.5 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
              <SearchableSelect
                key={g.member_nuids.length}
                variant="link"
                options={people
                  .filter((p) => !g.member_nuids.includes(p.nuid))
                  .map((p) => ({ value: p.nuid, label: label(p.nuid) }))}
                onValueChange={(nuid) =>
                  run(
                    m.updateCategory.mutateAsync({
                      id: g.id,
                      members: [...g.member_nuids, nuid],
                    })
                  )
                }
                placeholder="+ Add person"
                searchPlaceholder="Search people"
                emptyText="No one matches"
                className="mt-1"
                ariaLabel={`Add someone to ${g.name}`}
              />
            </div>
          </div>
        ))}
        {adding && (
          <div className="border-ink flex flex-col gap-1 border border-dashed bg-white px-4 py-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={create}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setNewName('')
                  setAdding(false)
                }
              }}
              placeholder="Group name"
              className="text-ink placeholder:text-text-faint border-b border-gray-200 bg-transparent pb-1 font-semibold outline-none focus:border-gray-400"
            />
            <span className="text-text-subtle text-xs">
              Press Enter to create, Esc to cancel
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function StaffingTable({
  cycleId,
  roles,
}: {
  cycleId: string
  roles: { id: string; name: string }[]
}) {
  const { groups, positions, label, m, run } = useTeam(cycleId)
  const { data: steps = [] } = useCycleSteps(cycleId)
  const showReview = !!stepConfig(steps, 'reviews')?.enabled
  const showInterview = !!stepConfig(steps, 'interviews')?.enabled
  const cols = cn(
    'grid gap-3 md:gap-4',
    showReview && showInterview
      ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]'
      : 'md:grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)]'
  )
  if (!showReview && !showInterview)
    return (
      <p className="text-text-subtle px-5 py-4 text-sm">
        Reviews and interviews are both switched off in Openings & process.
      </p>
    )
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          cols,
          'font-display text-text-subtle hidden border-b border-gray-100 px-5 py-2 text-[11px] tracking-wider uppercase md:grid'
        )}
      >
        <span>Opening</span>
        {showReview && <span>Reviewed by</span>}
        {showInterview && <span>Interviewed by</span>}
      </div>
      {roles.map((r) => {
        const team = positions.find((p) => p.role_id === r.id)
        if (!team) return null
        const save = (patch: Partial<typeof team>) => {
          const next = { ...team, ...patch }
          return run(
            m.setPosition.mutateAsync({
              roleId: r.id,
              reviewGroups: next.review_groups,
              interviewGroups: next.interview_groups,
            })
          )
        }
        return (
          <div
            key={r.id}
            className={cn(
              cols,
              'border-b border-gray-100 px-5 py-3 last:border-b-0'
            )}
          >
            <span className="text-ink truncate pt-0.5 font-medium">
              {r.name}
            </span>
            {showReview && (
              <GroupPicker
                groups={groups}
                picked={team.review_groups}
                people={team.reviewers.map(label)}
                onChange={(ids) => save({ review_groups: ids })}
              />
            )}
            {showInterview && (
              <GroupPicker
                groups={groups}
                picked={team.interview_groups}
                people={team.interviewers.map(label)}
                onChange={(ids) => save({ interview_groups: ids })}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function GroupPicker({
  groups,
  picked,
  people,
  onChange,
}: {
  groups: { id: string; name: string }[]
  picked: string[]
  people: string[]
  onChange: (ids: string[]) => void
}) {
  const names = groups.filter((g) => picked.includes(g.id)).map((g) => g.name)
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:border-ink flex w-fit max-w-full items-center gap-2 border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors"
          >
            <span className="text-ink truncate">
              {names.length ? names.join(', ') : 'Everyone'}
            </span>
            <ChevronDown size={14} className="text-text-subtle shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-1" align="start">
          {groups.length === 0 ? (
            <p className="text-text-subtle px-2 py-1.5 text-sm">
              Make a group above first.
            </p>
          ) : (
            groups.map((g) => {
              const on = picked.includes(g.id)
              return (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onChange(
                        on
                          ? picked.filter((x) => x !== g.id)
                          : [...picked, g.id]
                      )
                    }
                    className="accent-ink h-3.5 w-3.5"
                  />
                  {g.name}
                </label>
              )
            })
          )}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <p className="text-text-subtle px-2 pb-1 text-xs">
              No group picked means everyone.
            </p>
          </div>
        </PopoverContent>
      </Popover>
      {picked.length > 0 && <Faces names={people} />}
    </div>
  )
}

function Faces({ names }: { names: string[] }) {
  if (names.length === 0)
    return <span className="text-text-subtle text-xs">Nobody yet</span>
  const shown = names.slice(0, 4)
  return (
    <span title={names.join(', ')} className="flex items-center">
      {shown.map((n, i) => (
        <span
          key={n}
          className={cn(
            'text-ink flex size-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold ring-2 ring-white',
            i > 0 && '-ml-1.5'
          )}
        >
          {n
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
      ))}
      <span className="text-text-muted ml-1.5 text-xs">
        {names.length > shown.length
          ? `+${names.length - shown.length}`
          : names.length}
      </span>
    </span>
  )
}

export function ConflictsEditor({ cycleId }: { cycleId: string }) {
  const { data: conflicts = [] } = useReviewConflicts(cycleId)
  const { data: applicants = [] } = useApplications({ cycle_id: cycleId })
  const { data: staff = [] } = useCycleStaff(cycleId)
  const setConflict = useSetConflict(cycleId)
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [person, setPerson] = useState('')

  async function save(vars: Parameters<typeof setConflict.mutateAsync>[0]) {
    try {
      await setConflict.mutateAsync(vars)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  const team = staff.map((m) => ({
    value: m.user_nuid,
    label: `${m.full_name}${m.role === 'chief' ? ' (chief)' : ''}`,
  }))
  const people = [
    ...new Map(applicants.map((a) => [a.user_nuid, a.full_name])).entries(),
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conflicts.map((c) => (
        <Chip
          key={`${c.lead_nuid}:${c.applicant_nuid}`}
          label={`${c.lead_name} won’t see ${c.applicant_name}`}
          onRemove={() =>
            save({
              lead: c.lead_nuid,
              applicant: c.applicant_nuid,
              remove: true,
            })
          }
        />
      ))}
      {adding ? (
        <>
          <SearchableSelect
            options={team}
            value={person}
            onValueChange={setPerson}
            placeholder="Person"
            searchPlaceholder="Search leads and chiefs"
            emptyText="No one matches"
            className="h-8 w-40"
            ariaLabel="Person with a conflict"
          />
          <span className="text-text-subtle text-sm">
            shouldn&apos;t review
          </span>
          <SearchableSelect
            options={people.map(([nuid, name]) => ({
              value: nuid,
              label: name,
            }))}
            onValueChange={async (applicant) => {
              if (!person) {
                toast('Pick the person first', { variant: 'error' })
                return
              }
              await save({ lead: person, applicant })
              setPerson('')
              setAdding(false)
            }}
            placeholder="Applicant"
            searchPlaceholder="Search applicants"
            emptyText="No applicants"
            className="h-8 w-40"
            ariaLabel="Applicant they know"
          />
          <button
            type="button"
            onClick={() => {
              setPerson('')
              setAdding(false)
            }}
            className="text-text-subtle hover:text-ink text-sm"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-text-muted hover:text-ink ml-1 text-sm font-medium"
        >
          + Add conflict
        </button>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="text-ink flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pr-1 pl-2.5 text-sm">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="text-text-subtle hover:text-ink p-1 hover:bg-gray-200"
      >
        <X size={12} />
      </button>
    </span>
  )
}
