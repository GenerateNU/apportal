import type { CycleStaffRole } from '@/generated/model'

// Mirrors the backend's access.StaffRolesFor: who gets any access to a cycle
// of each type. Nobody sees applications at their own level or above.
const STAFF_ROLES_BY_TYPE: Record<string, CycleStaffRole[]> = {
  member: ['chief', 'lead'],
  lead: ['chief'],
  chief: [],
}

export function staffRolesFor(applicationType: string): CycleStaffRole[] {
  return STAFF_ROLES_BY_TYPE[applicationType] ?? []
}

export const STAFF_ROLE_LABEL: Record<CycleStaffRole, string> = {
  chief: 'Chief',
  lead: 'Lead',
}

export function staffHelpText(applicationType: string): string {
  switch (applicationType) {
    case 'member':
      return 'Chiefs run this cycle; leads review its applications.'
    case 'lead':
      return 'Chiefs run lead cycles and review lead applications. Leads can’t see them.'
    case 'chief':
      return 'Chief cycles have no staff — only admins review chief applications.'
    default:
      return ''
  }
}
