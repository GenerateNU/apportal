import type { UserRole } from '@/lib/api/types'

export function isAdmin(roles: UserRole[]): boolean {
  return roles.includes('admin')
}

export function withAdmin(roles: UserRole[]): UserRole[] {
  return isAdmin(roles) ? roles : [...roles, 'admin']
}

// A user with no roles can't sign in anywhere, so they keep applicant.
export function withoutAdmin(roles: UserRole[]): UserRole[] {
  const rest = roles.filter((r) => r !== 'admin')
  return rest.length > 0 ? rest : ['applicant']
}
