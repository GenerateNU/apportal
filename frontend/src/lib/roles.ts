import type { Role } from '@/lib/api/types'

export const ROLE_COLUMNS: Role[] = ['software_engineer', 'software_designer']

export const ROLE_LABEL: Record<Role, string> = {
  software_engineer: 'Software Engineer',
  software_designer: 'Software Designer',
}

// Matches the chip palette in globals.css (--color-chip-1..10-bg/-text),
// assigned by each role's position in ROLE_COLUMNS.
export const ROLE_CHIP_CLASS: Record<Role, string> = {
  software_engineer: 'bg-chip-1-bg text-chip-1-text',
  software_designer: 'bg-chip-2-bg text-chip-2-text',
}
