import type { Cycle, Role } from '@/lib/api/types'

// Matches the chip palette in globals.css (--color-chip-1..10-bg/-text).
// Literal strings so Tailwind can see every class.
export const ROLE_CHIP_CLASSES = [
  'bg-chip-1-bg text-chip-1-text',
  'bg-chip-2-bg text-chip-2-text',
  'bg-chip-3-bg text-chip-3-text',
  'bg-chip-4-bg text-chip-4-text',
  'bg-chip-5-bg text-chip-5-text',
  'bg-chip-6-bg text-chip-6-text',
  'bg-chip-7-bg text-chip-7-text',
  'bg-chip-8-bg text-chip-8-text',
  'bg-chip-9-bg text-chip-9-text',
  'bg-chip-10-bg text-chip-10-text',
] as const

export interface RoleLookup {
  // The roles (and their IDs) of the given cycle, or every role without one.
  roles: Role[]
  roleIds: string[]
  roleLabel: (id: string) => string
  roleChipClass: (id: string) => string
}

// Builds label/colour lookups over every role; a role's colour comes from its
// position within its own cycle, so it's the same on every page.
export function buildRoleLookup(
  allRoles: Role[],
  cycleId?: string
): RoleLookup {
  const byId = new Map<string, { role: Role; index: number }>()
  const seen = new Map<string, number>()
  for (const role of allRoles) {
    const index = seen.get(role.cycle_id) ?? 0
    seen.set(role.cycle_id, index + 1)
    byId.set(role.id, { role, index })
  }
  const roles = cycleId
    ? allRoles.filter((r) => r.cycle_id === cycleId)
    : allRoles

  return {
    roles,
    roleIds: roles.map((r) => r.id),
    roleLabel: (id) => byId.get(id)?.role.name ?? 'Unknown role',
    roleChipClass: (id) =>
      ROLE_CHIP_CLASSES[(byId.get(id)?.index ?? 0) % ROLE_CHIP_CLASSES.length],
  }
}

// For views spanning cycles, where every cycle has its own "Software Engineer".
export function withCycleNames(
  lookup: RoleLookup,
  cycles: Cycle[]
): RoleLookup {
  const cycleName = new Map(cycles.map((c) => [c.id, c.name]))
  const roleCycle = new Map(lookup.roles.map((r) => [r.id, r.cycle_id]))
  return {
    ...lookup,
    roleLabel: (id) => {
      const name = cycleName.get(roleCycle.get(id) ?? '')
      return name ? `${lookup.roleLabel(id)} · ${name}` : lookup.roleLabel(id)
    },
  }
}

export function cycleRoleIds(roles: Role[], cycleId: string): string[] {
  return roles.filter((r) => r.cycle_id === cycleId).map((r) => r.id)
}

// What role-scoped pages open on.
export function defaultRoleId(
  roles: Role[],
  cycleId: string
): string | undefined {
  return cycleRoleIds(roles, cycleId)[0]
}

// The user's pick while it's still one of roleIds (switching cycles changes
// the roles), else the first role.
export function resolvePickedRole(
  picked: string | null | undefined,
  roleIds: string[]
): string {
  return picked && roleIds.includes(picked) ? picked : (roleIds[0] ?? '')
}

// A role filter's value: the picked role ID while it's one of roleIds, else
// 'all'. A pick is kept while roles are still loading.
export function resolveRoleFilter(
  picked: string,
  roleIds: string[],
  loading: boolean
): string {
  return picked === 'all' || loading || roleIds.includes(picked)
    ? picked
    : 'all'
}
