import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  getUser,
  getUserByEmail,
  getUsers,
  updateUser,
} from '@/lib/api/users'
import type { FetchOptions } from '@/lib/api/client'
import type { ReviewerRole } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/auth-context'
import { queryKeys } from './keys'

export function useUsers(reviewerRole?: ReviewerRole, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.users.list(reviewerRole),
    queryFn: () => getUsers(reviewerRole, opts),
  })
}

export function useUser(nuid: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.users.detail(nuid),
    queryFn: () => getUser(nuid, opts),
    enabled: !!nuid,
  })
}

// Resolves the logged-in Supabase session to its backend user record. Sessions
// only carry an email, so this is the bridge to nuid/full_name/roles.
export function useCurrentUser(opts?: FetchOptions) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const email = user?.email

  const query = useQuery({
    queryKey: queryKeys.users.byEmail(email ?? ''),
    queryFn: () => getUserByEmail(email!, opts),
    enabled: !!email,
  })

  return { ...query, isLoading: isAuthLoading || query.isLoading }
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createUser>[0]
      opts?: FetchOptions
    }) => createUser(vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      nuid: string
      body: Parameters<typeof updateUser>[1]
      opts?: FetchOptions
    }) => updateUser(vars.nuid, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.users.detail(vars.nuid), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() })
    },
  })
}
