import type { UserRole } from '@/lib/api/types'

// Highest-privilege first.
export const USER_ROLE_ORDER: UserRole[] = [
  'admin',
  'chief',
  'lead',
  'member',
  'applicant',
]

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  chief: 'Chief',
  lead: 'Lead',
  member: 'Member',
  applicant: 'Applicant',
}

// A "member" is anyone holding at least one staff role — someone who applied
// and was never brought on (roles: ["applicant"], or none) doesn't belong on
// this page, even though the same User row represents them.
export function isMember(roles: UserRole[]): boolean {
  return roles.some((r) => r !== 'applicant')
}

// The single role shown in the table's Role column (highest-privilege one a
// user holds). They may hold more — the column shows a "+N" hint for that and
// editing always operates on the full set via RoleEditDialog.
export function getPrimaryRole(roles: UserRole[]): UserRole {
  for (const role of USER_ROLE_ORDER) {
    if (roles.includes(role)) return role
  }
  return 'applicant'
}
