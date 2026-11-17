import { useMemo } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createUser,
  getCurrentUser,
  listUsers,
  updateUser,
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

// nuid -> display name for anyone a review surface has to attribute something
// to. Built from the role lists rather than per-nuid lookups because
// GET /users/{nuid} is chief-only: a lead resolving reviewers one at a time
// just collects 403s and falls back to rendering raw nuids.
export function useReviewerNames() {
  const { data: leads = [] } = useLeads()
  const { data: chiefReviewers } = useChiefReviewers()
  return useMemo(() => {
    const byNuid = new Map<string, string>()
    for (const u of [...leads, ...chiefReviewers]) {
      byNuid.set(u.nuid, u.full_name)
    }
    return byNuid
  }, [leads, chiefReviewers])
}

export function useAdmins(opts?: RequestOptions) {
  return useQuery({
    queryKey: [...queryKeys.users.lists(), 'admin'],
    queryFn: async () =>
      ((await listUsers({ role: 'admin' }, opts))?.users ?? []) as User[],
  })
}

// Resolves the signed-in Supabase session to its backend user record
// (nuid/full_name/roles) — the backend derives identity from the request's
// verified session, so this needs no arguments.
export function useCurrentUser(opts?: RequestOptions) {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.users.me(user?.id ?? ''),
    queryFn: () => getCurrentUser(opts) as Promise<User>,
    enabled: !!user,
  })
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
