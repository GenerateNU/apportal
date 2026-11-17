'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { CARD_GRID, SECTION } from '@/components/ui/page-shell'
import { Subheading } from '@/components/ui/subheading'
import { PageHeader } from '@/components/ui/page-header'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWorkflow } from '@/lib/queries/workflow'
import { ArrowRight, Plus, Users, X } from 'lucide-react'
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
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { cn } from '@/lib/utils'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { TeamCard } from './TeamCard'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { PreferenceListSummary } from '@/lib/api/types'
import {
  useCreatePreferenceList,
  useDeletePreferenceList,
  usePreferenceListDeadline,
  usePreferenceListDetails,
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

  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const { data: details = [] } = usePreferenceListDetails(cycleId)
  const countsFor = (listId: string) => {
    const entries = details.find((d) => d.id === listId)?.entries ?? []
    return roleIds.map((r) => ({
      label: roleLabel(r),
      count: entries.filter((e) => e.role_id === r).length,
    }))
  }
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<PreferenceListSummary | null>(null)
  const deleteList = useDeletePreferenceList()
  const { data: lists = [] } = usePreferenceLists(cycleId)

  const submitted = lists.filter((l) => l.status === 'submitted').length
  const allSubmitted = lists.length > 0 && submitted === lists.length
  const { data: workflow } = useWorkflow(cycleId)
  const draftPage = (workflow?.phases ?? [])
    .flatMap((p) => p.pages ?? [])
    .find((p) => p.page === 'draft')
  const draftLocked = !draftPage || !!draftPage.locked_reason
  const [closing, setClosing] = useState(false)
  const closeLists = useSetPreferenceListDeadline()
  const router = useRouter()

  async function closeAndStart() {
    const now = new Date().toISOString()
    await Promise.all(
      roleIds.map((roleId) =>
        closeLists.mutateAsync({ cycleId, roleId, closesAt: now })
      )
    )
    router.push('/reviewer/draft')
  }

  return (
    <>
      <PageHeader
        title="Teams & preference lists"
        subtitle="Form teams and have each one rank who they want before the draft."
        actions={
          <>
            {cycleId && (
              <Button variant="outline" asChild>
                <Link
                  href={`/reviewer/preference-lists/candidates?cycle=${cycleId}`}
                >
                  <Users size={14} />
                  Compare candidates
                </Link>
              </Button>
            )}
          </>
        }
      />

      {!cycleId ? (
        <EmptyState title="No cycles yet" />
      ) : (
        <>
          {isChief && (
            <section className={SECTION}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Subheading
                  title="Deadline"
                  hint={
                    !draftLocked
                      ? 'Lists are closed. The draft is ready.'
                      : lists.length > 0
                        ? `${submitted} of ${lists.length} teams submitted. Teams can edit until the deadline.`
                        : 'Teams can edit their lists until then.'
                  }
                />
                {!draftLocked ? (
                  <Button asChild>
                    <Link href="/reviewer/draft">
                      Start the draft
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    disabled={!allSubmitted}
                    title={
                      allSubmitted
                        ? undefined
                        : lists.length === 0
                          ? 'Create teams first'
                          : `${lists.length - submitted} ${lists.length - submitted === 1 ? "team hasn't" : "teams haven't"} submitted`
                    }
                    onClick={() => setClosing(true)}
                  >
                    Start the draft
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
              <Card padding="none" className="divide-y divide-gray-100">
                {roleIds.map((r) => (
                  <DeadlineEditor key={r} cycleId={cycleId} role={r} />
                ))}
              </Card>
            </section>
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
                    counts={countsFor(list.id)}
                    onDelete={isChief ? () => setDeleting(list) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title="Close lists and start the draft?"
        description="Every team has submitted. This closes preference lists now, so teams can't edit them anymore."
        confirmLabel="Close lists and start"
        pending={closeLists.isPending}
        onConfirm={closeAndStart}
      />

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
        <span
          className={cn(
            'text-xs',
            !closesAt
              ? 'text-amber-600'
              : closed
                ? 'text-green-700'
                : 'text-text-muted'
          )}
        >
          {!closesAt ? 'Not set' : closed ? 'Closed' : closesIn(closesAt, now)}
        </span>
      </div>
      {closed && closesAt ? (
        <span className="text-text-muted text-sm">
          {closesAt.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      ) : (
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
      )}
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

function closesIn(at: Date, now: number) {
  const mins = Math.max(1, Math.round((at.getTime() - now) / 60_000))
  if (mins < 60) return `Closes in ${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `Closes in ${hours}h`
  return `Closes in ${Math.round(hours / 24)} days`
}
