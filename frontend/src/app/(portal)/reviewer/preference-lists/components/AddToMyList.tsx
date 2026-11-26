'use client'

import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { APIError } from '@/lib/api/client'
import {
  usePreferenceListDeadlines,
  useDeletePreferenceListEntry,
  usePreferenceListDetails,
  useUpsertPreferenceListEntry,
} from '@/lib/queries/preference-lists'
import { queryKeys } from '@/lib/queries/keys'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/queries/users'
import { deadlinePassed } from '../[id]/components/deadline'
import {
  WANTED_BY_MANY,
  WANTED_BY_NONE,
} from '../../applications/components/FilterButton'

export type ListActionVariant = 'chip' | 'cell'

export type ListAction = {
  listId: string
  render: (applicationId: string, variant?: ListActionVariant) => ReactNode
}

export function matchesWanted(teamCount: number, wanted: string[]) {
  if (wanted.length === 0) return true
  return (
    (wanted.includes(WANTED_BY_MANY) && teamCount > 1) ||
    (wanted.includes(WANTED_BY_NONE) && teamCount === 0)
  )
}

export function ListActionChip({
  rank,
  listName,
  locked,
  pending,
  onAdd,
  onRemove,
  variant = 'chip',
}: {
  variant?: ListActionVariant
  rank?: number
  listName: string
  locked: boolean
  pending: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  if (variant === 'cell') {
    if (rank === undefined) {
      if (locked) return <span className="text-gray-300">—</span>
      return (
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={`Add to ${listName}`}
          title={`Add to ${listName}`}
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
        >
          <Plus />
        </Button>
      )
    }
    return (
      <span className="relative inline-flex">
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
        {!locked && (
          <button
            type="button"
            aria-label={`Remove from ${listName}`}
            title={`Remove from ${listName}`}
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="hover:text-ink text-text-muted absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </span>
    )
  }
  if (rank !== undefined) {
    return (
      <span className="text-ink inline-flex h-6 items-stretch border border-gray-200 bg-gray-50 text-xs whitespace-nowrap">
        <span className="flex items-center gap-1 px-2">
          <span className="font-semibold tabular-nums">#{rank}</span>
          <span className="text-text-muted">on your list</span>
        </span>
        {!locked && (
          <button
            type="button"
            aria-label={`Remove from ${listName}`}
            title={`Remove from ${listName}`}
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="text-text-muted hover:text-ink flex items-center border-l border-gray-200 px-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={12} />
          </button>
        )}
      </span>
    )
  }
  if (locked) return null
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation()
        onAdd()
      }}
    >
      <Plus />
      Add to {listName}
    </Button>
  )
}

export function useMyTeamListAction(
  cycleId: string,
  roleId: string
): ListAction | undefined {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: me } = useCurrentUser()
  const { data: lists = [] } = usePreferenceListDetails(cycleId)
  const closesAt = usePreferenceListDeadlines(cycleId, [roleId])[roleId]
  const upsert = useUpsertPreferenceListEntry()
  const remove = useDeletePreferenceListEntry()
  const list = me
    ? lists.find((l) => l.members.some((m) => m.lead_nuid === me.nuid))
    : undefined
  if (!list) return undefined

  const callbacks = (failure: string) => ({
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.allDetails(cycleId),
      }),
    onError: (err: Error) =>
      toast(err instanceof APIError ? err.message : failure, {
        variant: 'error',
      }),
  })
  const pendingId = upsert.isPending
    ? upsert.variables?.applicationId
    : remove.isPending
      ? remove.variables?.applicationId
      : undefined

  return {
    listId: list.id,
    render: (applicationId, variant) => (
      <ListActionChip
        variant={variant}
        rank={
          list.entries.find(
            (e) => e.application_id === applicationId && e.role_id === roleId
          )?.rank
        }
        listName={list.name}
        locked={deadlinePassed(closesAt)}
        pending={pendingId === applicationId}
        onAdd={() =>
          upsert.mutate(
            { listId: list.id, applicationId },
            callbacks("Couldn't add them")
          )
        }
        onRemove={() =>
          remove.mutate(
            { listId: list.id, applicationId },
            callbacks("Couldn't remove them")
          )
        }
      />
    ),
  }
}
