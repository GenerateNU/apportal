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
