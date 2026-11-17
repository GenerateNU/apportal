import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCycleStaff,
  listMyCycles,
  removeCycleStaff,
  setCycleStaff,
} from '@/generated/cycle-staff/cycle-staff'
import type {
  CycleStaff,
  CycleStaffMember,
  CycleStaffRole,
} from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { staffAccess } from '@/lib/auth/staff'
import { useCycles } from './cycles'
import { queryKeys } from './keys'
import { useCurrentUser } from './users'

export function useMyCycles(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycleStaff.mine(),
    queryFn: async () => ((await listMyCycles(opts)) ?? []) as CycleStaff[],
  })
}

export function useStaffCycles(opts?: RequestOptions) {
  const { data: user } = useCurrentUser()
  const { data: mine = [], isLoading: mineLoading } = useMyCycles()
  const q = useCycles(undefined, opts)
  const isAdmin = !!user?.roles.some((r) => r === 'admin')
  const ids = new Set(mine.map((m) => m.cycle_id))
  return {
    ...q,
    isLoading: q.isLoading || mineLoading,
    data: q.data?.filter((c) => isAdmin || ids.has(c.id)),
  }
}

export function useStaffAccess() {
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const { data: mine = [], isLoading: mineLoading } = useMyCycles()
  return {
    ...staffAccess(user, mine),
    isLoading: userLoading || mineLoading,
  }
}

export function useIsChief() {
  return useStaffAccess().isChief
}

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

// Adds someone to a cycle's staff, or changes their role. Invalidates "mine"
// too, since the caller may have just changed their own access.
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleStaff.all }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleStaff.all }),
  })
}
