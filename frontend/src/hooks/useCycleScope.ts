'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { scopeCycles } from '@/lib/cycle-scope'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useBranches } from '@/lib/queries/branches'
import { useStaffAccess, useStaffCycles } from '@/lib/queries/cycle-staff'
import { useCycleRoles } from '@/lib/queries/roles'

const STORAGE_KEY: Record<'chief' | 'lead', string> = {
  chief: 'chief-cycle',
  lead: 'lead-cycle',
}

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readStored(mode: 'chief' | 'lead') {
  try {
    return localStorage.getItem(STORAGE_KEY[mode])
  } catch {
    return null
  }
}

export function useCycleScope(mode: 'chief' | 'lead' = 'chief') {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data: allCycles = [] } = useStaffCycles()
  const { data: branches = [] } = useBranches()
  const { isAdmin, chiefCycleIds, staffCycleIds, isLoading } = useStaffAccess()
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(mode),
    () => null
  )

  const cycles = useMemo(
    () =>
      scopeCycles(allCycles, { isAdmin, staffCycleIds, chiefCycleIds }, mode),
    [allCycles, chiefCycleIds, staffCycleIds, isAdmin, mode]
  )
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
    listeners.forEach((l) => l())
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

export function useCycleFilter(mode: 'chief' | 'lead') {
  const scope = useCycleScope(mode)
  const [all, setAll] = useState(false)
  return {
    cycles: scope.cycles,
    cycleId: all || !scope.cycleId ? 'all' : scope.cycleId,
    setCycleId(id: string) {
      setAll(id === 'all')
      if (id !== 'all') scope.setCycleId(id)
    },
  }
}
