'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import type { Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import {
  useCreatePreferenceList,
  usePreferenceListDeadline,
  usePreferenceLists,
  useSetPreferenceListDeadline,
} from '@/lib/queries/preference-lists'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-green-50 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
}

export function PreferenceListsPageClient({ isChief }: { isChief: boolean }) {
  const searchParams = useSearchParams()
  const { data: cycles = [] } = useCycles({})

  const [cycleId, setCycleId] = useState(searchParams.get('cycle') ?? '')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const roleParam = searchParams.get('role')
  const [role, setRole] = useState<Role>(
    roleParam === 'software_designer'
      ? 'software_designer'
      : 'software_engineer'
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: lists = [] } = usePreferenceLists(cycleId, role)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-48" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {cycleId && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus data-icon="inline-start" size={14} />
            Create list
          </Button>
        )}
      </div>

      {isChief && cycleId && <DeadlineEditor cycleId={cycleId} role={role} />}

      {!cycleId ? (
        <p className="text-text-faint px-1 text-sm">No cycles yet.</p>
      ) : lists.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No preference lists yet for this cycle/role — create one to get
          started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/reviewer/preference-lists/${list.id}`}
              className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-text-default truncate text-sm font-medium">
                  {list.name}
                </p>
                <ArrowRight
                  size={14}
                  className="text-text-faint group-hover:text-brand-blue mt-0.5 shrink-0 transition-transform group-hover:translate-x-1"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[list.status]}`}
                >
                  {STATUS_LABEL[list.status]}
                </span>
                <span className="text-text-subtle text-xs">
                  {list.entry_count} entr{list.entry_count === 1 ? 'y' : 'ies'}
                </span>
                {list.meeting_day && (
                  <span className="bg-brand-blue/10 text-brand-blue rounded-md px-1.5 py-0.5 text-xs font-medium">
                    Meets {MEETING_DAY_LABEL[list.meeting_day]}
                  </span>
                )}
              </div>
              <p className="text-text-subtle truncate text-xs">
                {list.member_names.length > 0
                  ? list.member_names.join(', ')
                  : 'No members yet'}
              </p>
            </Link>
          ))}
        </div>
      )}

      <CreateListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cycleId={cycleId}
        role={role}
      />
    </>
  )
}

function DeadlineEditor({ cycleId, role }: { cycleId: string; role: Role }) {
  const { data: deadline } = usePreferenceListDeadline(cycleId, role)
  const setDeadline = useSetPreferenceListDeadline()

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
      <span className="text-text-muted font-medium">
        Submission deadline for {ROLE_LABEL[role]}:
      </span>
      <DateTimePicker
        value={deadline?.closes_at ? new Date(deadline.closes_at) : undefined}
        onValueChange={(date) =>
          setDeadline.mutate({
            cycleId,
            role,
            closesAt: date.toISOString(),
          })
        }
        placeholder="No deadline set"
      />
      {deadline?.closes_at && (
        <button
          type="button"
          onClick={() => setDeadline.mutate({ cycleId, role, closesAt: null })}
          className="text-text-faint hover:text-text-muted inline-flex items-center gap-1 text-xs"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  )
}

function CreateListDialog({
  open,
  onOpenChange,
  cycleId,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleId: string
  role: Role
}) {
  const [name, setName] = useState('')
  const createList = useCreatePreferenceList()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !cycleId) return
    createList.mutate(
      { cycleId, role, name: trimmed },
      {
        onSuccess: () => {
          setName('')
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New preference list</DialogTitle>
            <DialogDescription>
              You&apos;ll be added as its first member. Invite other leads once
              it&apos;s created.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preference-list-name">List name</Label>
            <Input
              id="preference-list-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Alpha"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createList.isPending || !name.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
