import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
