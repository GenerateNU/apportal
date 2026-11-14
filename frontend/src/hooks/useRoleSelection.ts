'use client'

// Kept apart from lib/queries/roles so server pages can import fetchRoles
// without pulling in useState.
import { useMemo, useState } from 'react'
import { useCycles } from '@/lib/queries/cycles'
import { useCycleRoles, useRoleLookup } from '@/lib/queries/roles'
import {
  resolvePickedRole,
  resolveRoleFilter,
  withCycleNames,
} from '@/lib/roles'

// A role picker for a cycle's page, starting from `initial` (e.g. a ?role=
// param) and falling back to the cycle's first role.
export function useCycleRolePicker(cycleId: string, initial?: string | null) {
  const lookup = useCycleRoles(cycleId)
  const [picked, setRole] = useState(initial ?? undefined)
  return {
    ...lookup,
    role: resolvePickedRole(picked, lookup.roleIds),
    setRole,
  }
}

// An "all roles or one" filter for a cycle's page. activeRole is a role ID or
// 'all'; a pick that isn't one of the cycle's roles reads as 'all'. A cycleId
// of 'all' (cross-cycle queues) offers every role, labelled with its cycle.
export function useCycleRoleFilter(cycleId: string) {
  const every = useRoleLookup()
  const scoped = useCycleRoles(cycleId === 'all' ? '' : cycleId)
  const { data: cycles } = useCycles({})
  const lookup = useMemo(
    () =>
      cycleId === 'all'
        ? { ...withCycleNames(every, cycles ?? []), isLoading: every.isLoading }
        : scoped,
    [cycleId, every, scoped, cycles]
  )
  const [picked, setActiveRole] = useState('all')
  return {
    ...lookup,
    activeRole: resolveRoleFilter(picked, lookup.roleIds, lookup.isLoading),
    setActiveRole,
  }
}
