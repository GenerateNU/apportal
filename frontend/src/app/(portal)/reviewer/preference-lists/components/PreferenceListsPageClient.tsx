'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { PageSection } from '@/components/ui/page-section'
import { CARD_GRID, SECTION } from '@/components/ui/page-shell'
import { Subheading } from '@/components/ui/subheading'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { TeamCard } from './TeamCard'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { PreferenceListSummary } from '@/lib/api/types'
import {
  useCreatePreferenceList,
  useDeletePreferenceList,
  usePreferenceListDeadline,
  usePreferenceLists,
  useSetPreferenceListDeadline,
} from '@/lib/queries/preference-lists'
import { useCycleRoles, useRoleLookup } from '@/lib/queries/roles'

export function PreferenceListsPageClient({ isChief }: { isChief: boolean }) {
  const searchParams = useSearchParams()
  const { data: cycles = [] } = useStaffCycles()

  const [cycleId, setCycleId] = useState(searchParams.get('cycle') ?? '')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const { roleIds } = useCycleRoles(cycleId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<PreferenceListSummary | null>(null)
  const deleteList = useDeletePreferenceList()
  const { data: lists = [] } = usePreferenceLists(cycleId)

  const submitted = lists.filter((l) => l.status === 'submitted').length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {cycles.length > 1 && (
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="h-9 w-40" aria-label="Filter by cycle">
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
          )}
        </div>
        {cycleId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link
                href={`/reviewer/preference-lists/candidates?cycle=${cycleId}`}
              >
                <Users size={14} />
                View candidates
              </Link>
            </Button>
          </div>
        )}
      </div>

      {!cycleId ? (
        <EmptyState title="No cycles yet" />
      ) : (
        <>
          {isChief && (
            <PageSection
              label="Deadline"
              hint="Teams can edit their lists until then. The draft unlocks once every deadline passes."
            >
              <Card padding="none" className="divide-y divide-gray-100">
                {roleIds.map((r) => (
                  <DeadlineEditor key={r} cycleId={cycleId} role={r} />
                ))}
              </Card>
            </PageSection>
          )}
          <section className={SECTION}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Subheading
                title={`Teams · ${lists.length}`}
                hint={
                  lists.length > 0
                    ? `${submitted} of ${lists.length} submitted their list.`
                    : undefined
                }
              />
              <Button onClick={() => setDialogOpen(true)}>
                <Plus data-icon="inline-start" size={14} />
                New team
              </Button>
            </div>
            {lists.length === 0 ? (
              <EmptyState
                title="No teams yet"
                description="Create a team, then open it to add people."
              />
            ) : (
              <div className={CARD_GRID}>
                {lists.map((list) => (
                  <TeamCard
                    key={list.id}
                    list={list}
                    onDelete={isChief ? () => setDeleting(list) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this team?"
        description={`${deleting?.name ?? ''} and its rankings are deleted for everyone.`}
        confirmLabel="Delete team"
        pending={deleteList.isPending}
        onConfirm={() =>
          deleting &&
          deleteList.mutate(
            { id: deleting.id, cycleId },
            { onSuccess: () => setDeleting(null) }
          )
        }
      />

      <CreateListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cycleId={cycleId}
      />
    </>
  )
}

function DeadlineEditor({ cycleId, role }: { cycleId: string; role: string }) {
  const { roleLabel } = useRoleLookup()
  const { data: deadline } = usePreferenceListDeadline(cycleId, role)
  const setDeadline = useSetPreferenceListDeadline()
  const closesAt = deadline?.closes_at ? new Date(deadline.closes_at) : null
  const [now] = useState(() => Date.now())
  const closed = !!closesAt && closesAt.getTime() <= now

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-ink truncate font-semibold">
          {roleLabel(role)}
        </span>
        <Badge
          size="sm"
          className={
            !closesAt
              ? 'text-text-muted bg-gray-100'
              : closed
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
          }
        >
          {!closesAt ? 'Not set' : closed ? 'Closed' : 'Open'}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {setDeadline.isError && (
          <span className="text-xs text-red-600">Couldn&apos;t save</span>
        )}
        <DateTimePicker
          value={closesAt ?? undefined}
          onValueChange={(date) =>
            setDeadline.mutate({
              cycleId,
              roleId: role,
              closesAt: date.toISOString(),
            })
          }
          placeholder="Set a deadline"
        />
        {closesAt && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Clear deadline"
            onClick={() =>
              setDeadline.mutate({ cycleId, roleId: role, closesAt: null })
            }
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

function CreateListDialog({
  open,
  onOpenChange,
  cycleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleId: string
}) {
  const [name, setName] = useState('')
  const createList = useCreatePreferenceList()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !cycleId) return
    createList.mutate(
      { cycleId, name: trimmed },
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
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>
              Add people to it once it&apos;s created.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preference-list-name">Team name</Label>
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
