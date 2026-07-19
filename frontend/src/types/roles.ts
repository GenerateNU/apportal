import type { User } from '@/lib/api/types'

export type Role = 'applicant' | 'reviewer' | 'admin'

export function getRoles(user: User): Role[] {
  const roles = new Set<Role>()
  for (const role of user.roles) {
    if (role === 'admin') roles.add('admin')
    else if (role === 'applicant') roles.add('applicant')
    else roles.add('reviewer') // member, lead, chief
  }
  return [...roles]
}

// The landing page ("portal") for a user, based on the roles they hold. Users
// with multiple roles land on the most privileged staff surface first.
export function defaultDashboard(roles: Role[]): string {
  if (roles.includes('reviewer')) return '/reviewer/dashboard'
  if (roles.includes('admin')) return '/admin/applications'
  if (roles.includes('applicant')) return '/applicant/applications'
  return '/login'
}
