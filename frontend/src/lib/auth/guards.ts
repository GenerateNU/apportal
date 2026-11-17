import { notFound } from 'next/navigation'
import { APIError } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { getServerCurrentUser, getServerStaffAccess } from './server-user'
import type { StaffAccess } from './staff'

async function orNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (err) {
    if (err instanceof APIError && (err.status === 401 || err.status === 403))
      notFound()
    throw err
  }
}

export function requireSignedIn(): Promise<User> {
  return orNotFound(getServerCurrentUser)
}

export async function requireStaff(): Promise<StaffAccess> {
  const access = await orNotFound(getServerStaffAccess)
  if (!access.isStaff) notFound()
  return access
}

export async function requireChief(cycleId?: string): Promise<StaffAccess> {
  const access = await orNotFound(getServerStaffAccess)
  const allowed = cycleId
    ? access.isAdmin || access.chiefCycleIds.includes(cycleId)
    : access.isChief
  if (!allowed) notFound()
  return access
}

export async function requireAdmin(): Promise<StaffAccess> {
  const access = await orNotFound(getServerStaffAccess)
  if (!access.isAdmin) notFound()
  return access
}
