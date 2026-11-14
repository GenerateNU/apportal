import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCycleTag,
  deleteTag,
  listCycleTags,
  setApplicationTags,
  updateTag,
} from '@/generated/tags/tags'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Application, CycleTag } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useCycleTags(cycleId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.tags.cycle(cycleId),
    queryFn: async () =>
      ((await listCycleTags(cycleId, opts)) ?? []) as CycleTag[],
    enabled: !!cycleId,
  })
}

export function useCreateTag(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCycleTag(cycleId, { name }),
    onSuccess: (tag) => {
      queryClient.setQueryData<CycleTag[]>(
        queryKeys.tags.cycle(cycleId),
        (tags = []) => [...tags, tag]
      )
    },
  })
}

export function useUpdateTag(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; color?: string }) =>
      updateTag(vars.id, { name: vars.name, color: vars.color }),
    onSuccess: (tag) => {
      queryClient.setQueryData<CycleTag[]>(
        queryKeys.tags.cycle(cycleId),
        (tags = []) => tags.map((t) => (t.id === tag.id ? tag : t))
      )
    },
  })
}

// A deleted tag disappears from every application in the cycle, so cached
// applications are refetched rather than patched one by one.
export function useDeleteTag(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<CycleTag[]>(
        queryKeys.tags.cycle(cycleId),
        (tags = []) => tags.filter((t) => t.id !== id)
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
    },
  })
}

export function useSetApplicationTags(applicationId: string) {
  const queryClient = useQueryClient()
  const detailKey = queryKeys.applications.detail(applicationId)
  return useMutation({
    mutationFn: (tagIds: string[]) =>
      setApplicationTags(applicationId, { tag_ids: tagIds }),
    // Optimistic: the picker should feel instant, and the server's answer is
    // the same list.
    onMutate: async (tagIds) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<Application>(detailKey)
      queryClient.setQueryData<Application>(detailKey, (app) =>
        app ? { ...app, tag_ids: tagIds } : app
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}
