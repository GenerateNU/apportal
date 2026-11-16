import type { Cycle } from '@/lib/api/types'

type Access = {
  isAdmin: boolean
  staffCycleIds: string[]
  chiefCycleIds: string[]
}

// The cycles someone can pick in the sidebar: admins see every cycle, staff
// the ones they're on (or run, in chief mode). Closed cycles never show.
export function scopeCycles(
  cycles: Cycle[],
  access: Access,
  mode: 'chief' | 'lead'
): Cycle[] {
  const ids = mode === 'chief' ? access.chiefCycleIds : access.staffCycleIds
  return cycles.filter(
    (c) => c.status !== 'closed' && (access.isAdmin || ids.includes(c.id))
  )
}
