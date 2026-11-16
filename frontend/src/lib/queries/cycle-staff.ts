import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCycleStaff,
  listMyCycles,
  removeCycleStaff,
  setCycleStaff,
} from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaffMember } from '@/generated/model/cycleStaffMember'
import type { CycleStaff } from '@/generated/model/cycleStaff'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { staffAccess } from '@/lib/auth/staff'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useBranches } from './branches'
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

export function useOffCycle(isChief: boolean) {
  const { data: mine = [], isFetched } = useMyCycles()
  return !isChief && isFetched && mine.length === 0
}

export function useLeadCycle() {
  const { data: mine = [], isLoading } = useMyCycles()
  const { data: cycles = [] } = useStaffCycles()
  const { data: branches = [] } = useBranches()
  const staffed = mine.flatMap(
    (m) => cycles.find((c) => c.id === m.cycle_id) ?? []
  )
  const cycleId = defaultPipelineCycleId(staffed)
  const cycle = staffed.find((c) => c.id === cycleId)
  const branch = branches.find((b) => b.id === cycle?.branch_id)
  return { cycle, branch, isLoading }
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

export function useCycleStaff(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.cycleStaff.list(cycleId),
    queryFn: async () =>
      ((await listCycleStaff(cycleId)) ?? []) as CycleStaffMember[],
    enabled: !!cycleId,
  })
}

export function useSetLead(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { nuid: string; remove?: boolean }) => {
      if (vars.remove) await removeCycleStaff(cycleId, vars.nuid)
      else await setCycleStaff(cycleId, vars.nuid, { role: 'lead' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleStaff.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}
