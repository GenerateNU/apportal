import type { CycleStatus, Role } from '@/lib/api/types'

export const ROLE_COLUMNS: Role[] = ['software_engineer', 'software_designer']

export const roleLabel: Record<Role, string> = {
  software_engineer: 'Software Engineer',
  software_designer: 'Software Designer',
}

export const roleDot: Record<Role, string> = {
  software_engineer: 'bg-role-engineer',
  software_designer: 'bg-role-designer',
}

export const cycleStatusBadge: Record<CycleStatus, string> = {
  draft: 'bg-status-draft-bg text-status-draft-text',
  open: 'bg-status-open-bg text-status-open-text',
  closed: 'bg-status-closed-bg text-status-closed-text',
  archived: 'bg-status-archived-bg text-status-archived-text',
}

export const cycleStatusLabel: Record<CycleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}
