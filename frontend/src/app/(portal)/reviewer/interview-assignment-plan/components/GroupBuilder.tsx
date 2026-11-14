'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InterviewGroupDetail } from '@/generated/model'
import { apiErrorDetail } from '@/lib/api/client'
import { DaySelect } from './DaySelect'
import {
  useCreateInterviewGroups,
  useDeleteInterviewGroup,
  useUpdateInterviewGroup,
} from '@/lib/queries/interview-groups'

export type DraftGroupDay = { groupId: string; day: string }

type Lead = { nuid: string; full_name: string }

export function formGroups(nuids: string[], size: number): string[][] {
  const count = Math.max(1, Math.floor(nuids.length / size))
  const groups: string[][] = Array.from({ length: count }, () => [])
  nuids.forEach((nuid, i) => groups[i % count].push(nuid))
  return groups.filter((g) => g.length > 0)
}

export function nextGroupNames(taken: string[], count: number): string[] {
  const used = new Set(taken)
  const names: string[] = []
  for (let n = 1; names.length < count; n++) {
    const name = `Group ${n}`
    if (!used.has(name)) names.push(name)
  }
  return names
}

export function GroupBuilder({
  cycleId,
  leads,
  groups,
  size,
  days,
  onDaysChange,
}: {
  cycleId: string
  leads: Lead[]
  groups: InterviewGroupDetail[]
  size: number
  days: DraftGroupDay[]
  onDaysChange: (value: DraftGroupDay[]) => void
}) {
  const createGroups = useCreateInterviewGroups()
  const deleteGroup = useDeleteInterviewGroup()

  const grouped = new Set(
    groups.flatMap((g) => (g.members ?? []).map((m) => m.member_nuid))
  )
  const ungrouped = leads.filter((l) => !grouped.has(l.nuid))

  function setDay(groupId: string, day: string) {
    const next = days.filter((d) => d.groupId !== groupId)
    if (day) next.push({ groupId, day })
    onDaysChange(next)
  }

  function autoForm() {
    const memberSets = formGroups(
      ungrouped.map((l) => l.nuid),
      size
    )
    const names = nextGroupNames(
      groups.map((g) => g.name),
      memberSets.length
    )
    createGroups.mutate({
      cycleId,
      groups: memberSets.map((member_nuids, i) => ({
        name: names[i],
        member_nuids,
      })),
    })
  }

  function addEmpty() {
    const [name] = nextGroupNames(
      groups.map((g) => g.name),
      1
    )
    createGroups.mutate({ cycleId, groups: [{ name, member_nuids: [] }] })
  }

  function remove(id: string) {
    deleteGroup.mutate(id)
    onDaysChange(days.filter((d) => d.groupId !== id))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-text-default text-sm font-semibold">
            Interview groups
          </h2>
          <p className="text-text-muted mt-0.5 text-xs">
            Each group interviews together, so it gets one meeting day. Groups
            are saved; days are set each time you plan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addEmpty}
            disabled={!cycleId || createGroups.isPending}
          >
            <Plus size={14} />
            New group
          </Button>
          <Button
            size="sm"
            onClick={autoForm}
            disabled={
              !cycleId || ungrouped.length === 0 || createGroups.isPending
            }
          >
            {createGroups.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Users size={14} />
            )}
            Auto-form groups of {size}
          </Button>
        </div>
      </div>

      {createGroups.isError && (
        <p className="text-destructive text-xs">
          Couldn&apos;t create groups: {apiErrorDetail(createGroups.error)}
        </p>
      )}
      {deleteGroup.isError && (
        <p className="text-destructive text-xs">
          Couldn&apos;t delete the group: {apiErrorDetail(deleteGroup.error)}
        </p>
      )}

      {ungrouped.length > 0 && (
        <p className="text-text-muted text-xs">
          Not in a group: {ungrouped.map((l) => l.full_name).join(', ')}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-text-faint rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm">
          No groups yet. Auto-form them from the leads, or add one by hand.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              addable={ungrouped}
              size={size}
              day={days.find((d) => d.groupId === group.id)?.day ?? ''}
              onDayChange={(day) => setDay(group.id, day)}
              onDelete={() => remove(group.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function GroupCard({
  group,
  addable,
  size,
  day,
  onDayChange,
  onDelete,
}: {
  group: InterviewGroupDetail
  addable: Lead[]
  size: number
  day: string
  onDayChange: (day: string) => void
  onDelete: () => void
}) {
  const update = useUpdateInterviewGroup()
  const [name, setName] = useState(group.name)
  const members = group.members ?? []
  const memberNuids = members.map((m) => m.member_nuid)

  function save(next: { name?: string; member_nuids?: string[] }) {
    update.mutate({
      id: group.id,
      body: {
        name: next.name ?? group.name,
        member_nuids: next.member_nuids ?? memberNuids,
        meeting_slot: group.meeting_slot,
      },
    })
  }

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) {
      setName(group.name)
      return
    }
    save({ name: trimmed })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          aria-label="Group name"
          className="h-8 text-sm font-medium"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <DaySelect
          value={day}
          onChange={onDayChange}
          label={`Meeting day for ${group.name}`}
          className="flex-shrink-0"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          aria-label={`Delete ${group.name}`}
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {members.length === 0 && (
          <span className="text-text-faint text-xs">No members yet.</span>
        )}
        {members.map((m) => (
          <span
            key={m.member_nuid}
            className="text-text-default inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs"
          >
            {m.full_name}
            <button
              type="button"
              aria-label={`Remove ${m.full_name}`}
              className="text-text-faint hover:text-text-default"
              onClick={() =>
                save({
                  member_nuids: memberNuids.filter((n) => n !== m.member_nuid),
                })
              }
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Select
          value=""
          onValueChange={(nuid) =>
            save({ member_nuids: [...memberNuids, nuid] })
          }
        >
          <SelectTrigger
            className="h-8 w-48 text-xs"
            aria-label={`Add a member to ${group.name}`}
            disabled={addable.length === 0}
          >
            <SelectValue placeholder="Add a member" />
          </SelectTrigger>
          <SelectContent>
            {addable.map((l) => (
              <SelectItem key={l.nuid} value={l.nuid}>
                {l.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          className={`text-xs ${members.length < size ? 'text-amber-700' : 'text-text-faint'}`}
        >
          {members.length} of {size}
        </span>
      </div>

      {update.isError && (
        <p className="text-destructive text-xs">
          Couldn&apos;t save the group: {apiErrorDetail(update.error)}
        </p>
      )}
    </div>
  )
}
