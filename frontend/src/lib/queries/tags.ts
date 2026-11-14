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
  const listsKey = queryKeys.applications.lists()
  return useMutation({
    mutationFn: (tagIds: string[]) =>
      setApplicationTags(applicationId, { tag_ids: tagIds }),
    // Optimistic: the picker should feel instant, and the server's answer is
    // the same list. Lists are patched too so the table row updates in place.
    onMutate: async (tagIds) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      await queryClient.cancelQueries({ queryKey: listsKey })
      const previous = queryClient.getQueryData<Application>(detailKey)
      const previousLists = queryClient.getQueriesData({ queryKey: listsKey })
      queryClient.setQueryData<Application>(detailKey, (app) =>
        app ? { ...app, tag_ids: tagIds } : app
      )
      queryClient.setQueriesData({ queryKey: listsKey }, (data) =>
        withRowTags(data, applicationId, tagIds)
      )
      return { previous, previousLists }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous)
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}

type Rows = {
  applications?: { id: string; tag_ids?: string[] | null }[] | null
}

// Cached lists are either one envelope or an infinite query's `{ pages }` of
// envelopes; swap the tags on the matching row in whichever it is.
function withRowTags(data: unknown, applicationId: string, tagIds: string[]) {
  const patch = (page: Rows): Rows => ({
    ...page,
    applications: page.applications?.map((a) =>
      a.id === applicationId ? { ...a, tag_ids: tagIds } : a
    ),
  })
  if (data && typeof data === 'object' && 'pages' in data) {
    const infinite = data as { pages: Rows[] }
    return { ...infinite, pages: infinite.pages.map(patch) }
  }
  return data && typeof data === 'object' ? patch(data as Rows) : data
}
