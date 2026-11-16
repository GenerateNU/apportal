import type { CycleStaff } from '@/generated/model/cycleStaff'
import type { User } from '@/lib/api/types'

export type StaffAccess = {
  isAdmin: boolean
  isChief: boolean
  isStaff: boolean
  chiefCycleIds: string[]
  staffCycleIds: string[]
}

export function staffAccess(
  user: Pick<User, 'roles'> | undefined,
  mine: Pick<CycleStaff, 'cycle_id' | 'role'>[]
): StaffAccess {
  const isAdmin = !!user?.roles.some((r) => r === 'admin')
  const chiefCycleIds = mine
    .filter((m) => m.role === 'chief')
    .map((m) => m.cycle_id)
  return {
    isAdmin,
    isChief: isAdmin || chiefCycleIds.length > 0,
    isStaff: isAdmin || mine.length > 0,
    chiefCycleIds,
    staffCycleIds: mine.map((m) => m.cycle_id),
  }
}
