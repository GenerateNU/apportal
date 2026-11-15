import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCycleStaff,
  removeCycleStaff,
  setCycleStaff,
} from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaffMember, CycleStaffRole } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { queryKeys } from './keys'

export async function fetchCycleStaff(cycleId: string, opts?: RequestOptions) {
  return ((await listCycleStaff(cycleId, opts)) ?? []) as CycleStaffMember[]
}

// Chiefs first, then by name (the backend's order).
export function useCycleStaff(cycleId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycleStaff.list(cycleId),
    queryFn: () => fetchCycleStaff(cycleId, opts),
    enabled: !!cycleId,
  })
}

// Adds someone to the cycle's staff, or changes their role.
export function useSetCycleStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      nuid: string
      role: CycleStaffRole
      opts?: RequestOptions
    }) =>
      setCycleStaff(vars.cycleId, vars.nuid, { role: vars.role }, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cycleStaff.list(vars.cycleId),
      })
    },
  })
}

export function useRemoveCycleStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      nuid: string
      opts?: RequestOptions
    }) => removeCycleStaff(vars.cycleId, vars.nuid, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cycleStaff.list(vars.cycleId),
      })
    },
  })
}
