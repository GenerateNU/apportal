import type { User } from './user'

export type Role = 'applicant' | 'reviewer' | 'admin'

export function getRoles(user: User): Role[] {
  const roles: Role[] = ['applicant']
  if (user.is_reviewer) roles.push('reviewer')
  if (user.is_admin) roles.push('admin')
  return roles
}
