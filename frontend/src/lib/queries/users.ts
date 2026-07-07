import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, getUser, getUsers, updateUser } from '@/lib/api/users'
import type { FetchOptions } from '@/lib/api/client'
import type { ReviewerRole } from '@/lib/api/types'
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
