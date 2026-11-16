'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useBranches } from '@/lib/queries/branches'
import { useStaffAccess, useStaffCycles } from '@/lib/queries/cycle-staff'
import { useCycleRoles } from '@/lib/queries/roles'

const STORAGE_KEY: Record<'chief' | 'lead', string> = {
  chief: 'chief-cycle',
  lead: 'lead-cycle',
}

export function useCycleScope(mode: 'chief' | 'lead' = 'chief') {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data: allCycles = [] } = useStaffCycles()
  const { data: branches = [] } = useBranches()
  const { isAdmin, chiefCycleIds, staffCycleIds, isLoading } = useStaffAccess()
  const [stored, setStored] = useState<string | null>(null)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStored(localStorage.getItem(STORAGE_KEY[mode]))
    } catch {}
  }, [mode])

  const cycles = useMemo(() => {
    if (isAdmin) return allCycles
    const ids = mode === 'chief' ? chiefCycleIds : staffCycleIds
    return allCycles.filter((c) => ids.includes(c.id))
  }, [allCycles, chiefCycleIds, staffCycleIds, isAdmin, mode])
  const isCycle = (id?: string | null): id is string =>
    !!id && cycles.some((c) => c.id === id)
  const urlCycle = params.get('cycle')
  const cycleId =
    (isCycle(urlCycle) ? urlCycle : null) ??
    (isCycle(stored) ? stored : null) ??
    defaultPipelineCycleId(cycles) ??
    ''
  const cycle = cycles.find((c) => c.id === cycleId)
  const branch = branches.find((b) => b.id === cycle?.branch_id)

  const roles = useCycleRoles(cycleId)
  const roleParam = params.get('role')
  const roleId =
    roleParam && roles.roleIds.includes(roleParam)
      ? roleParam
      : (roles.roleIds[0] ?? '')

  function replaceParams(next: URLSearchParams) {
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  function setCycleId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY[mode], id)
    } catch {}
    setStored(id)
    const next = new URLSearchParams(params)
    next.set('cycle', id)
    next.delete('role')
    replaceParams(next)
  }

  function setRoleId(id: string) {
    const next = new URLSearchParams(params)
    next.set('role', id)
    replaceParams(next)
  }

  return {
    cycles,
    cycle,
    cycleId,
    branch,
    setCycleId,
    roleId,
    setRoleId,
    roles,
    isLoading: isLoading || (!cycle && cycles.length > 0),
  }
}

export type CycleScope = ReturnType<typeof useCycleScope>
