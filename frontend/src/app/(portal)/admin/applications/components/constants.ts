import type { CycleStatus, Role } from '@/lib/api/types'

export const ROLE_COLUMNS: Role[] = ['software_engineer', 'software_designer']

export const roleLabel: Record<Role, string> = {
  software_engineer: 'Software Engineer',
  software_designer: 'Software Designer',
}

// Rotating chip palette defined in globals.css (--color-chip-1..6). Colors
// are assigned by hashing the role name so new roles get one automatically,
// without needing an explicit color mapping per role.
const CHIP_PALETTE = [
  'bg-chip-1',
  'bg-chip-2',
  'bg-chip-3',
  'bg-chip-4',
  'bg-chip-5',
  'bg-chip-6',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function roleDot(role: Role): string {
  return CHIP_PALETTE[hashString(role) % CHIP_PALETTE.length]
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
