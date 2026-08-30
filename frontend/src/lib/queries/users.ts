import { useMemo } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import {
  createUser,
  getCurrentUser,
  getListUsersInfiniteQueryKey,
  getUser,
  listUsers,
  updateUser,
  useListUsersInfinite,
} from '@/generated/users/users'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { UsersOutputBody } from '@/generated/model'
import type { ReviewerRole, User } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/auth-context'
import { queryKeys } from './keys'

// The generated infinite-query hook (used by useMembersInfinite) keys its
// cache under orval's own ['infinate', '/users', ...] namespace, not
// queryKeys.users.* — invalidate both so mutations refresh every list view.
function invalidateUserLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() })
  queryClient.invalidateQueries({ queryKey: getListUsersInfiniteQueryKey() })
}

// Omitting `limit` (as both hooks below do) returns every matching user in
// one unpaginated response — e.g. useLeads backs the reviewer-assignment
// dropdown, which needs every lead, never just a page of them.
export function useUsers(reviewerRole?: ReviewerRole, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.users.list(reviewerRole),
    queryFn: async () =>
      ((await listUsers({ role: reviewerRole }, opts))?.users ?? []) as User[],
  })
}

// Users holding the lead role — e.g. to pick reviewers to assign.
export function useLeads(opts?: RequestOptions) {
  return useQuery({
    queryKey: [...queryKeys.users.lists(), 'lead'],
    queryFn: async () =>
      ((await listUsers({ role: 'lead' }, opts))?.users ?? []) as User[],
  })
}

// Users holding the chief role — e.g. to pick an interviewer, which per
// info.md can be a lead or a chief.
export function useChiefs(opts?: RequestOptions) {
  return useQuery({
    queryKey: [...queryKeys.users.lists(), 'chief'],
    queryFn: async () =>
      ((await listUsers({ role: 'chief' }, opts))?.users ?? []) as User[],
  })
}

// Chiefs and admins — who together can cast a chief review vote
// (`requireChief` on the backend accepts either role), so this is the
// denominator for "x/y chiefs reviewed". `useChiefs` alone undercounts:
// it's scoped to the interviewer picker, where admins aren't included.
export function useChiefReviewers(opts?: RequestOptions) {
  const queries = useQueries({
    queries: (['chief', 'admin'] as const).map((role) => ({
      queryKey: [...queryKeys.users.lists(), role],
      queryFn: async () =>
        ((await listUsers({ role }, opts))?.users ?? []) as User[],
    })),
  })
  const data = useMemo(() => {
    const byNuid = new Map<string, User>()
    for (const q of queries) {
      for (const u of q.data ?? []) byNuid.set(u.nuid, u)
    }
    return Array.from(byNuid.values())
  }, [queries])
  return { data, isLoading: queries.some((q) => q.isLoading) }
}

// Paginated member list for admin/members' infinite scroll. `limit` is a
// fixed page size chosen by the caller.
export function useMembersInfinite(limit: number, opts?: RequestOptions) {
  return useListUsersInfinite(
    { limit },
    {
      query: {
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
          lastPage?.has_more ? allPages.length * limit : undefined,
      },
      request: opts,
    }
  )
}

export function useUser(nuid: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.users.detail(nuid),
    queryFn: () => getUser(nuid, opts) as Promise<User>,
    enabled: !!nuid,
  })
}

// Resolves the signed-in Supabase session to its backend user record
// (nuid/full_name/roles) — the backend derives identity from the request's
// verified session, so this needs no arguments.
export function useCurrentUser(opts?: RequestOptions) {
  const { user, isLoading: isAuthLoading } = useAuth()

  const query = useQuery({
    queryKey: queryKeys.users.me(user?.id ?? ''),
    queryFn: () => getCurrentUser(opts) as Promise<User>,
    enabled: !!user,
  })

  return { ...query, isLoading: isAuthLoading || query.isLoading }
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createUser>[0]
      opts?: RequestOptions
    }) => createUser(vars.body, vars.opts),
    onSuccess: () => {
      invalidateUserLists(queryClient)
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      nuid: string
      body: Parameters<typeof updateUser>[1]
      opts?: RequestOptions
    }) => updateUser(vars.nuid, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.users.detail(vars.nuid), data)
      invalidateUserLists(queryClient)
    },
  })
}

// Chief/admin-only, per the backend. Separate from useUpdateUser because the
// flag is denormalized onto every ApplicationSummary and preference-list
// entry the reviewer surfaces render — invalidating only the user caches
// would leave every one of those badges stale.
export function useSetReturner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { nuid: string; returner: boolean }) =>
      updateUser(vars.nuid, { returner: vars.returner }),
    // The control is a checkbox in a paged table, and marking returners is a
    // batch job — a tick that waits on the round trip reads as a dropped
    // click. Rolled back below if the write fails.
    onMutate: async (vars) => {
      const listKey = getListUsersInfiniteQueryKey()
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueriesData({ queryKey: listKey })
      queryClient.setQueriesData<InfiniteData<UsersOutputBody>>(
        { queryKey: listKey },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              users:
                page.users?.map((u) =>
                  u.nuid === vars.nuid ? { ...u, returner: vars.returner } : u
                ) ?? null,
            })),
          }
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    // Settled rather than success: a failed write has to resync too, since the
    // rollback above restores a snapshot that may itself be stale by now.
    onSettled: (_data, _error, vars) => {
      invalidateUserLists(queryClient)
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(vars.nuid),
      })
      // Invalidated rather than written: the applicant cache holds the
      // profile subset of a user, not a user.
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicants.detail(vars.nuid),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.all,
      })
    },
  })
}
