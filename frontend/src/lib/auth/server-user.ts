import { cache } from 'react'
import { listMyCycles } from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaff } from '@/generated/model/cycleStaff'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { User } from '@/lib/api/types'
import { staffAccess } from './staff'

// Per-request memo: the portal layout and most pages both need /users/me, and
// this keeps that to one backend call per render.
export const getServerCurrentUser = cache(
  async () => (await getCurrentUser(await getServerRequestOptions())) as User
)

export const getServerStaffAccess = cache(async () => {
  const options = await getServerRequestOptions()
  const [user, mine] = await Promise.all([
    getServerCurrentUser(),
    listMyCycles(options).then((rows) => (rows ?? []) as CycleStaff[]),
  ])
  return staffAccess(user, mine)
})

export async function getServerIsChief(): Promise<boolean> {
  try {
    return (await getServerStaffAccess()).isChief
  } catch {
    return false
  }
}
