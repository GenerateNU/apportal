import type { CycleStatus, Role } from '@/lib/api/types'

export const ROLE_COLUMNS: Role[] = ['software_engineer', 'software_designer']

export const roleLabel: Record<Role, string> = {
  software_engineer: 'Software Engineer',
  software_designer: 'Software Designer',
}

export const roleDot: Record<Role, string> = {
  software_engineer: 'bg-blue-500',
  software_designer: 'bg-purple-500',
}

export const cycleStatusBadge: Record<CycleStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  open: 'bg-green-50 text-green-700',
  closed: 'bg-red-50 text-red-700',
  archived: 'bg-gray-100 text-gray-400',
}

export const cycleStatusLabel: Record<CycleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}
